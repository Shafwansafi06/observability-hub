"""
Vertex AI Model Deployment and Prediction Client
Handles model upload, endpoint management, and online predictions
"""

import os
import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from google.cloud import aiplatform
from google.api_core import retry
from google.auth import default
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class VertexAIClient:
    """Client for Vertex AI model deployment and prediction"""
    
    def __init__(
        self,
        project_id: str,
        region: str = "us-central1",
        credentials_path: Optional[str] = None
    ):
        """
        Initialize Vertex AI client
        
        Args:
            project_id: Google Cloud project ID
            region: Vertex AI region
            credentials_path: Path to service account key (optional)
        """
        self.project_id = project_id
        self.region = region
        
        # Set credentials if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
        
        # Initialize Vertex AI SDK
        aiplatform.init(project=project_id, location=region)
        
        logger.info(f"Initialized Vertex AI client for project: {project_id}, region: {region}")
    
    def upload_model(
        self,
        display_name: str,
        container_image_uri: str,
        artifact_uri: str,
        description: Optional[str] = None,
        labels: Optional[Dict[str, str]] = None
    ) -> aiplatform.Model:
        """
        Upload a model to Vertex AI Model Registry
        
        Args:
            display_name: Human-readable model name
            container_image_uri: Docker container image URI
            artifact_uri: GCS path to model artifacts
            description: Model description
            labels: Metadata labels
            
        Returns:
            Uploaded model object
        """
        logger.info(f"Uploading model: {display_name}")
        
        model = aiplatform.Model.upload(
            display_name=display_name,
            artifact_uri=artifact_uri,
            serving_container_image_uri=container_image_uri,
            serving_container_health_route="/health",
            serving_container_predict_route="/predict",
            serving_container_ports=[8080],
            description=description or f"Model: {display_name}",
            labels=labels or {"environment": "production"},
            sync=True
        )
        
        logger.info(f"✅ Model uploaded: {model.resource_name}")
        logger.info(f"Model ID: {model.name}")
        
        return model
    
    def create_endpoint(
        self,
        display_name: str,
        description: Optional[str] = None,
        labels: Optional[Dict[str, str]] = None,
        enable_logging: bool = True,
        logging_sampling_rate: float = 0.1
    ) -> aiplatform.Endpoint:
        """
        Create a new prediction endpoint
        
        Args:
            display_name: Endpoint name
            description: Endpoint description
            labels: Metadata labels
            enable_logging: Enable request/response logging
            logging_sampling_rate: Fraction of requests to log (0.0-1.0)
            
        Returns:
            Created endpoint object
        """
        logger.info(f"Creating endpoint: {display_name}")
        
        endpoint = aiplatform.Endpoint.create(
            display_name=display_name,
            description=description or f"Endpoint: {display_name}",
            labels=labels or {"environment": "production"},
            enable_request_response_logging=enable_logging,
            request_response_logging_sampling_rate=logging_sampling_rate,
            sync=True
        )
        
        logger.info(f"✅ Endpoint created: {endpoint.resource_name}")
        logger.info(f"Endpoint ID: {endpoint.name}")
        
        return endpoint
    
    def deploy_model_to_endpoint(
        self,
        model: aiplatform.Model,
        endpoint: aiplatform.Endpoint,
        deployed_model_display_name: str,
        machine_type: str = "n1-highmem-8",
        min_replica_count: int = 2,
        max_replica_count: int = 20,
        accelerator_type: Optional[str] = None,
        accelerator_count: int = 0,
        traffic_percentage: int = 100,
        autoscaling_target_cpu_utilization: int = 70,
        autoscaling_target_accelerator_duty_cycle: int = 70
    ) -> Dict[str, Any]:
        """
        Deploy a model to an endpoint with autoscaling
        
        Args:
            model: Model to deploy
            endpoint: Target endpoint
            deployed_model_display_name: Name for deployed model
            machine_type: Machine type (e.g., n1-highmem-8)
            min_replica_count: Minimum number of replicas
            max_replica_count: Maximum number of replicas
            accelerator_type: GPU type (e.g., NVIDIA_TESLA_T4)
            accelerator_count: Number of GPUs per replica
            traffic_percentage: Percentage of traffic (0-100)
            autoscaling_target_cpu_utilization: CPU utilization target (%)
            autoscaling_target_accelerator_duty_cycle: GPU utilization target (%)
            
        Returns:
            Deployment information dictionary
        """
        logger.info(f"Deploying model {model.display_name} to endpoint {endpoint.display_name}")
        logger.info(f"Machine type: {machine_type}")
        logger.info(f"Replicas: {min_replica_count}-{max_replica_count}")
        logger.info(f"Traffic: {traffic_percentage}%")
        
        # Deploy model
        deployed_model = model.deploy(
            endpoint=endpoint,
            deployed_model_display_name=deployed_model_display_name,
            machine_type=machine_type,
            min_replica_count=min_replica_count,
            max_replica_count=max_replica_count,
            accelerator_type=accelerator_type if accelerator_type else None,
            accelerator_count=accelerator_count if accelerator_count > 0 else 0,
            traffic_percentage=traffic_percentage,
            traffic_split={},
            sync=True,
            deploy_request_timeout=1800,  # 30 minutes
            autoscaling_target_cpu_utilization=autoscaling_target_cpu_utilization,
            autoscaling_target_accelerator_duty_cycle=autoscaling_target_accelerator_duty_cycle
        )
        
        deployment_info = {
            "model_id": model.name,
            "endpoint_id": endpoint.name,
            "deployed_model_id": deployed_model.id,
            "machine_type": machine_type,
            "min_replicas": min_replica_count,
            "max_replicas": max_replica_count,
            "traffic_percentage": traffic_percentage,
            "deployed_at": datetime.utcnow().isoformat(),
            "predict_url": f"https://{self.region}-aiplatform.googleapis.com/v1/{endpoint.resource_name}:predict"
        }
        
        logger.info(f"✅ Model deployed successfully")
        logger.info(f"Deployed Model ID: {deployed_model.id}")
        
        return deployment_info
    
    def predict(
        self,
        endpoint: aiplatform.Endpoint,
        instances: List[Dict[str, Any]],
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Any]:
        """
        Make online predictions
        
        Args:
            endpoint: Endpoint to query
            instances: List of prediction instances
            parameters: Optional prediction parameters
            
        Returns:
            List of predictions
        """
        logger.info(f"Making prediction with {len(instances)} instances")
        
        prediction = endpoint.predict(
            instances=instances,
            parameters=parameters
        )
        
        logger.info(f"✅ Received {len(prediction.predictions)} predictions")
        
        return prediction.predictions
    
    @retry.Retry(
        initial=1.0,
        maximum=60.0,
        multiplier=2.0,
        deadline=300.0,
        predicate=retry.if_exception_type(Exception)
    )
    def predict_with_retry(
        self,
        endpoint: aiplatform.Endpoint,
        instances: List[Dict[str, Any]],
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Any]:
        """
        Make predictions with automatic retry on failures
        
        Args:
            endpoint: Endpoint to query
            instances: List of prediction instances
            parameters: Optional prediction parameters
            
        Returns:
            List of predictions
        """
        return self.predict(endpoint, instances, parameters)
    
    async def predict_async(
        self,
        endpoint: aiplatform.Endpoint,
        instances: List[Dict[str, Any]],
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Any]:
        """
        Make asynchronous predictions
        
        Args:
            endpoint: Endpoint to query
            instances: List of prediction instances
            parameters: Optional prediction parameters
            
        Returns:
            List of predictions
        """
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self.predict,
                endpoint,
                instances,
                parameters
            )
        return result
    
    async def predict_batch_parallel(
        self,
        endpoint: aiplatform.Endpoint,
        batch_instances: List[List[Dict[str, Any]]],
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[List[Any]]:
        """
        Make multiple batch predictions in parallel
        
        Args:
            endpoint: Endpoint to query
            batch_instances: List of batches, each containing instances
            parameters: Optional prediction parameters
            
        Returns:
            List of prediction results for each batch
        """
        logger.info(f"Making {len(batch_instances)} parallel batch predictions")
        
        tasks = [
            self.predict_async(endpoint, instances, parameters)
            for instances in batch_instances
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        successful_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch {i} failed: {result}")
                successful_results.append([])
            else:
                successful_results.append(result)
        
        logger.info(f"✅ Completed {len(successful_results)} batch predictions")
        
        return successful_results
    
    def update_traffic_split(
        self,
        endpoint: aiplatform.Endpoint,
        traffic_split: Dict[str, int]
    ) -> None:
        """
        Update traffic split between deployed models
        
        Args:
            endpoint: Endpoint to update
            traffic_split: Dict mapping deployed_model_id to traffic percentage
                          Example: {"1234": 90, "5678": 10}
        """
        logger.info(f"Updating traffic split for endpoint {endpoint.display_name}")
        logger.info(f"Traffic split: {traffic_split}")
        
        # Validate traffic split sums to 100
        total_traffic = sum(traffic_split.values())
        if total_traffic != 100:
            raise ValueError(f"Traffic split must sum to 100, got {total_traffic}")
        
        endpoint.update(traffic_split=traffic_split)
        
        logger.info("✅ Traffic split updated successfully")
    
    def undeploy_model(
        self,
        endpoint: aiplatform.Endpoint,
        deployed_model_id: str
    ) -> None:
        """
        Undeploy a model from an endpoint
        
        Args:
            endpoint: Endpoint containing the model
            deployed_model_id: ID of deployed model to remove
        """
        logger.info(f"Undeploying model {deployed_model_id} from endpoint {endpoint.display_name}")
        
        endpoint.undeploy(deployed_model_id=deployed_model_id, sync=True)
        
        logger.info("✅ Model undeployed successfully")
    
    def delete_endpoint(self, endpoint: aiplatform.Endpoint) -> None:
        """
        Delete an endpoint
        
        Args:
            endpoint: Endpoint to delete
        """
        logger.info(f"Deleting endpoint: {endpoint.display_name}")
        
        endpoint.delete(force=True, sync=True)
        
        logger.info("✅ Endpoint deleted successfully")
    
    def get_endpoint_metrics(
        self,
        endpoint: aiplatform.Endpoint,
        metric_type: str = "prediction_count",
        hours: int = 1
    ) -> Dict[str, Any]:
        """
        Get endpoint metrics from Cloud Monitoring
        
        Args:
            endpoint: Endpoint to query
            metric_type: Metric type (prediction_count, latency, error_count)
            hours: Number of hours to look back
            
        Returns:
            Metric data dictionary
        """
        from google.cloud import monitoring_v3
        
        client = monitoring_v3.MetricServiceClient()
        project_name = f"projects/{self.project_id}"
        
        # Build metric filter
        metric_filters = {
            "prediction_count": "aiplatform.googleapis.com/prediction/online/prediction_count",
            "latency": "aiplatform.googleapis.com/prediction/online/prediction_latencies",
            "error_count": "aiplatform.googleapis.com/prediction/online/error_count"
        }
        
        metric_filter = metric_filters.get(metric_type, metric_filters["prediction_count"])
        
        interval = monitoring_v3.TimeInterval(
            {
                "end_time": {"seconds": int(time.time())},
                "start_time": {"seconds": int(time.time() - hours * 3600)},
            }
        )
        
        aggregation = monitoring_v3.Aggregation(
            {
                "alignment_period": {"seconds": 60},
                "per_series_aligner": monitoring_v3.Aggregation.Aligner.ALIGN_RATE,
            }
        )
        
        results = client.list_time_series(
            request={
                "name": project_name,
                "filter": f'metric.type="{metric_filter}" AND resource.labels.endpoint_id="{endpoint.name}"',
                "interval": interval,
                "aggregation": aggregation,
            }
        )
        
        metrics = []
        for result in results:
            for point in result.points:
                metrics.append({
                    "timestamp": point.interval.end_time.isoformat(),
                    "value": point.value.double_value or point.value.int64_value
                })
        
        return {
            "metric_type": metric_type,
            "endpoint_id": endpoint.name,
            "data_points": metrics
        }


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = VertexAIClient(
        project_id=os.getenv("GOOGLE_CLOUD_PROJECT", "observability-hub-prod"),
        region=os.getenv("VERTEX_AI_REGION", "us-central1")
    )
    
    # Example: Upload and deploy model
    """
    model = client.upload_model(
        display_name="llm-gpt4-turbo-v1",
        container_image_uri="gcr.io/project/image:tag",
        artifact_uri="gs://bucket/models/v1"
    )
    
    endpoint = client.create_endpoint(
        display_name="llm-production-endpoint"
    )
    
    deployment_info = client.deploy_model_to_endpoint(
        model=model,
        endpoint=endpoint,
        deployed_model_display_name="gpt4-turbo-prod",
        machine_type="n1-highmem-8",
        min_replica_count=2,
        max_replica_count=20
    )
    
    # Make predictions
    predictions = client.predict(
        endpoint=endpoint,
        instances=[
            {"prompt": "Explain machine learning", "max_tokens": 100}
        ]
    )
    
    print(predictions)
    """
