$pwd = aws ecr get-login-password --region eu-west-2
[System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes($pwd)) | docker login --username AWS --password-stdin 717691231443.dkr.ecr.eu-west-2.amazonaws.com

<!-- OR IF THE ABOVE FAILS-->

$token = aws ecr get-login-password --region eu-west-2

$token.Length

docker login --username AWS --password $token 717691231443.dkr.ecr.eu-west-2.amazonaws.com

<!-- OR -->

aws ecr get-login-password --region eu-west-2 > token.txt
docker login --username AWS --password-stdin 717691231443.dkr.ecr.eu-west-2.amazonaws.com < token.txt

<!--AFTER LOGIN, TAG IMAGE BASH -->

docker tag ats-matcher-backend:latest \
717691231443.dkr.ecr.eu-west-2.amazonaws.com/ats-matcher-backend-repo:latest

<!-- PUSH TO ECR BASH -->

docker push 717691231443.dkr.ecr.eu-west-2.amazonaws.com/ats-matcher-backend-repo:latest

<!-- FORCE DEPLOYMENT BASH-->

aws ecs update-service \
 --cluster ats-matcher-backend-cluster \
 --service ats-matcher-backend-service \
 --force-new-deployment \
 --region eu-west-2
