// ETMS training UI — build, lint and deploy the Next.js container.
//
// The agent needs Docker and nothing else: npm never runs on the agent itself,
// it runs inside the builder image, so Node does not have to be installed or
// kept in step with the project.

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'ETMS_BACKEND_ORIGIN',
      defaultValue: 'http://etms-backend:8096/trainingmodule',
      description: 'Spring backend the /etms/api rewrite forwards to. Baked in at BUILD time — changing it requires a rebuild, not a restart. Never "localhost" here: inside the container that is the container itself.'
    )
    string(
      name: 'HOST_PORT',
      defaultValue: '3020',
      description: 'Port on the Docker host to publish the app on.'
    )
    string(
      name: 'DOCKER_NETWORK',
      defaultValue: '',
      description: 'Optional docker network to join, so the backend is reachable by container name. Leave blank to use the default bridge.'
    )
    booleanParam(
      name: 'DEPLOY',
      defaultValue: true,
      description: 'Untick to build and lint only, without replacing the running container.'
    )
  }

  environment {
    IMAGE     = 'etms-ui'
    CONTAINER = 'etms-ui'
    TAG       = "${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Building ${env.IMAGE}:${env.TAG} from ${env.GIT_SHA}"
      }
    }

    stage('Build') {
      steps {
        // --target builder stops at the compile stage, so the same layers are
        // reused by the runtime build below rather than compiled twice.
        sh """
          docker build \
            --target builder \
            --build-arg ETMS_BACKEND_ORIGIN='${params.ETMS_BACKEND_ORIGIN}' \
            -t ${IMAGE}:builder-${TAG} \
            .
        """
      }
    }

    stage('Lint') {
      steps {
        // Runs in the image just built, against the same node_modules the
        // compile used.
        sh "docker run --rm ${IMAGE}:builder-${TAG} npm run lint"
      }
    }

    stage('Package') {
      steps {
        sh """
          docker build \
            --build-arg ETMS_BACKEND_ORIGIN='${params.ETMS_BACKEND_ORIGIN}' \
            -t ${IMAGE}:${TAG} \
            -t ${IMAGE}:latest \
            .
        """
      }
    }

    stage('Deploy') {
      when { expression { return params.DEPLOY } }
      steps {
        script {
          def network = params.DOCKER_NETWORK?.trim() ? "--network ${params.DOCKER_NETWORK}" : ''
          sh """
            docker rm -f ${CONTAINER} || true
            docker run -d \
              --name ${CONTAINER} \
              --restart unless-stopped \
              ${network} \
              -p ${params.HOST_PORT}:3020 \
              ${IMAGE}:${TAG}
          """
        }
      }
    }

    stage('Smoke test') {
      when { expression { return params.DEPLOY } }
      steps {
        // Polls the login page rather than sleeping a fixed time: the
        // container is ready when it answers, not when a timer says so.
        sh """
          for i in \$(seq 1 30); do
            if curl -fsS -o /dev/null http://localhost:${params.HOST_PORT}/etms/Login; then
              echo "up after \${i}s"
              exit 0
            fi
            sleep 1
          done
          echo "app did not answer on /etms/Login within 30s"
          docker logs --tail 50 ${CONTAINER}
          exit 1
        """
      }
    }
  }

  post {
    success {
      echo "Deployed ${IMAGE}:${TAG} (${env.GIT_SHA}) on port ${params.HOST_PORT}"
    }
    failure {
      // The builder tag is the expensive one; keep the last good runtime image
      // so a failed build never leaves the host without something to roll back to.
      sh "docker image rm -f ${IMAGE}:builder-${TAG} || true"
    }
    always {
      // Intermediate builder images accumulate fast — one per build.
      sh "docker image rm -f ${IMAGE}:builder-${TAG} || true"
      sh 'docker image prune -f --filter "until=168h" || true'
    }
  }
}
