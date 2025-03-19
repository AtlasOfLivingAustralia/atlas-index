# Local Kubernetes Deployment

For local testing purposes, the following instructions will help you deploy the search stack to a local Kubernetes cluster.

### Requirements
1. Kubernetes cluster
2. Authentication service
3. A config file for search-service (see below)

### Update the cluster
```shell
kubectl apply -f search-stack.yaml
```

### Import a config file to the config map

Minimal config required includes:
```properties
# services
elastic.host=elasticsearch:9200
spring.data.mongodb.uri=mongodb://mongodb:27017/search
spring.data.mongodb.host=mongodb
rabbitmq.host=rabbitmq

# authentication, determined by the auth service in use
webservice.jwt-scopes=
webservice.client-id=
webservice.client-secret=
security.jwt.userIdClaim=
security.jwt.roleClaims=
security.jwt.rolesFromAccessToken=true
security.jwt.enabled=true
security.jwt.discovery-uri=
security.jwt.clientId=
security.admin.role=
```

Create a config map from a local file:
```shell
kubectl create configmap search-service-config --from-file=/path/to/search-service-config.properties -n search-namespace --dry-run=client -o yaml > /tmp/configmap.yaml
```

Apply the config map:
```shell
kubectl apply -f /tmp/configmap.yaml
```

## Other useful commands

### Port forwarding

search-service
```shell
kubectl port-forward deployment/search-service 8080:8080 -n search-namespace;
```

kibana
```shell
kubectl port-forward deployment/kibana 5601:5601 -n search-namespace;
```

rabbitmq
```shell
kubectl port-forward deployment/rabbitmq 15672:15672 -n search-namespace;
```

### View the config map
```shell
kubectl get configmap search-service-config -n search-namespace -o yaml
```

### Restart to pick up the search-service:latest image and/or after a config change
```shell
kubectl rollout restart deployment/search-service -n search-namespace
```
