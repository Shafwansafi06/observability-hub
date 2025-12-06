"""
Vertex AI Prediction Client

Production-ready client for Vertex AI online predictions with:
- Authentication (service account, ADC)
- Retry logic with exponential backoff
- Circuit breaker pattern
- Request/response logging
- OpenTelemetry tracing
- Streaming support
"""

import os
import json
import time
import logging
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum

import google.auth
from google.auth.transport.requests import Request
from google.cloud import aiplatform
from google.cloud.aiplatform.gapic import PredictionServiceClient
from google.protobuf import json_format
from google.protobuf.struct_pb2 import Value
import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# OpenTelemetry tracer
tracer = trace.get_tracer(__name__)


class PredictionError(Exception):
    """Base exception for prediction errors"""
    pass


class QuotaExceededError(PredictionError):
    """Raised when quota is exceeded"""
    pass


class ModelUnavailableError(PredictionError):
    """Raised when model is unavailable"""
    pass


@dataclass
class PredictionResponse:
    """Structured prediction response"""
    predictions: List[Any]
    deployed_model_id: str
    metadata: Dict[str, Any]
    latency_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "predictions": self.predictions,
            "deployed_model_id": self.deployed_model_id,
            "metadata": self.metadata,
            "latency_ms": self.latency_ms,
        }


class CircuitBreakerState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Circuit breaker for fault tolerance"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
            else:
                raise ModelUnavailableError("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        return (
            self.last_failure_time is not None
            and time.time() - self.last_failure_time >= self.recovery_timeout
        )
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.error(f"Circuit breaker opened after {self.failure_count} failures")


class PredictionClient:
    """
    Production-ready Vertex AI prediction client
    
    Features:
    - Automatic retry with exponential backoff
    - Circuit breaker for fault tolerance
    - Request/response logging
    - OpenTelemetry tracing
    - Multiple authentication methods
    
    Example:
        client = PredictionClient(
            project="my-project",
            location="us-central1",
            endpoint_id="1234567890"
        )
        
        response = client.predict({
            "prompt": "What is AI?",
            "max_tokens": 100
        })
        
        print(response.predictions[0])
    """
    
    def __init__(
        self,
        project: str,
        location: str,
        endpoint_id: str,
        credentials_path: Optional[str] = None,
        timeout: int = 60,
        enable_tracing: bool = True,
    ):
        """
        Initialize prediction client
        
        Args:
            project: GCP project ID
            location: GCP region (e.g., us-central1)
            endpoint_id: Vertex AI endpoint ID
            credentials_path: Path to service account JSON (optional)
            timeout: Request timeout in seconds
            enable_tracing: Enable OpenTelemetry tracing
        """
        self.project = project
        self.location = location
        self.endpoint_id = endpoint_id
        self.timeout = timeout
        self.enable_tracing = enable_tracing
        
        # Initialize credentials
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
        
        self.credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        
        # Initialize Vertex AI
        aiplatform.init(project=project, location=location, credentials=self.credentials)
        
        # Create prediction service client
        self.client = PredictionServiceClient(credentials=self.credentials)
        
        # Build endpoint path
        self.endpoint_path = self.client.endpoint_path(
            project=project,
            location=location,
            endpoint=endpoint_id
        )
        
        # Initialize circuit breaker
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60,
            expected_exception=Exception,
        )
        
        logger.info(f"Initialized PredictionClient for endpoint: {endpoint_id}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((requests.exceptions.RequestException, Exception)),
    )
    def predict(
        self,
        instances: Union[Dict, List[Dict]],
        parameters: Optional[Dict] = None,
    ) -> PredictionResponse:
        """
        Make a prediction request
        
        Args:
            instances: Single instance or list of instances
            parameters: Optional prediction parameters
        
        Returns:
            PredictionResponse with predictions and metadata
        
        Raises:
            PredictionError: On prediction failure
            QuotaExceededError: When quota is exceeded
            ModelUnavailableError: When model is unavailable
        """
        # Ensure instances is a list
        if isinstance(instances, dict):
            instances = [instances]
        
        # Start tracing span
        with tracer.start_as_current_span("vertex_ai_predict") as span:
            span.set_attribute("endpoint_id", self.endpoint_id)
            span.set_attribute("num_instances", len(instances))
            
            try:
                # Execute with circuit breaker
                result = self.circuit_breaker.call(
                    self._make_prediction_request,
                    instances,
                    parameters
                )
                
                span.set_status(Status(StatusCode.OK))
                return result
                
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logger.error(f"Prediction failed: {str(e)}")
                raise
    
    def _make_prediction_request(
        self,
        instances: List[Dict],
        parameters: Optional[Dict] = None,
    ) -> PredictionResponse:
        """Internal method to make prediction request"""
        start_time = time.time()
        
        # Convert instances to protobuf Value
        instances_proto = [json_format.ParseDict(inst, Value()) for inst in instances]
        
        # Convert parameters if provided
        parameters_proto = None
        if parameters:
            parameters_proto = json_format.ParseDict(parameters, Value())
        
        # Make prediction request
        try:
            response = self.client.predict(
                endpoint=self.endpoint_path,
                instances=instances_proto,
                parameters=parameters_proto,
                timeout=self.timeout,
            )
        except Exception as e:
            error_msg = str(e)
            
            # Handle specific errors
            if "quota" in error_msg.lower() or "429" in error_msg:
                raise QuotaExceededError(f"Quota exceeded: {error_msg}")
            elif "503" in error_msg or "unavailable" in error_msg.lower():
                raise ModelUnavailableError(f"Model unavailable: {error_msg}")
            else:
                raise PredictionError(f"Prediction failed: {error_msg}")
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Parse response
        predictions = [json_format.MessageToDict(pred) for pred in response.predictions]
        deployed_model_id = response.deployed_model_id
        metadata = json_format.MessageToDict(response.metadata) if response.metadata else {}
        
        # Log prediction
        logger.info(
            f"Prediction successful: "
            f"latency={latency_ms:.2f}ms, "
            f"deployed_model={deployed_model_id}, "
            f"num_predictions={len(predictions)}"
        )
        
        return PredictionResponse(
            predictions=predictions,
            deployed_model_id=deployed_model_id,
            metadata=metadata,
            latency_ms=latency_ms,
        )
    
    def predict_batch(
        self,
        instances: List[Dict],
        batch_size: int = 32,
        parameters: Optional[Dict] = None,
    ) -> List[PredictionResponse]:
        """
        Make batch predictions with automatic chunking
        
        Args:
            instances: List of instances to predict
            batch_size: Number of instances per batch
            parameters: Optional prediction parameters
        
        Returns:
            List of PredictionResponse objects
        """
        responses = []
        
        for i in range(0, len(instances), batch_size):
            batch = instances[i:i + batch_size]
            response = self.predict(batch, parameters)
            responses.append(response)
            
            logger.info(f"Processed batch {i // batch_size + 1}/{(len(instances) - 1) // batch_size + 1}")
        
        return responses
    
    def health_check(self) -> bool:
        """
        Check if endpoint is healthy
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            # Make a simple prediction with minimal instance
            self.predict({"health_check": True})
            return True
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return False
    
    def get_endpoint_info(self) -> Dict[str, Any]:
        """
        Get endpoint information
        
        Returns:
            Dictionary with endpoint metadata
        """
        from google.cloud import aiplatform_v1
        
        endpoint = aiplatform_v1.Endpoint(self.endpoint_path)
        
        return {
            "name": endpoint.name,
            "display_name": endpoint.display_name,
            "deployed_models": [
                {
                    "id": model.id,
                    "display_name": model.display_name,
                    "model_version_id": model.model_version_id,
                }
                for model in endpoint.deployed_models
            ],
            "traffic_split": dict(endpoint.traffic_split),
        }


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = PredictionClient(
        project=os.getenv("PROJECT_ID", "your-project"),
        location=os.getenv("REGION", "us-central1"),
        endpoint_id=os.getenv("ENDPOINT_ID", "1234567890"),
    )
    
    # Make prediction
    try:
        response = client.predict({
            "prompt": "Explain quantum computing in simple terms",
            "max_tokens": 200,
            "temperature": 0.7,
        })
        
        print(f"Prediction successful!")
        print(f"Latency: {response.latency_ms:.2f}ms")
        print(f"Deployed Model: {response.deployed_model_id}")
        print(f"Prediction: {response.predictions[0]}")
        
    except PredictionError as e:
        print(f"Prediction failed: {e}")
