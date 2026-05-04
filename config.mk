ENVIRONMENT             ?=
IMAGE_TAG               ?= latest
REGISTRY_HOST           ?= ghcr.io/boostylabs
CURRENT_DATE_TIME       := $(shell date +'%Y-%m-%d')
LATEST_COMMIT           := $$(git rev-parse --short HEAD)

# Image names.
INDEXER_IMAGE  := perp-dex-demo-indexer
FRONTEND_IMAGE := perp-dex-demo-frontend

# Tags: backup (date-commit) + latest.
INDEXER_BACKUP  = $(REGISTRY_HOST)/$(INDEXER_IMAGE)$(ENVIRONMENT):$(CURRENT_DATE_TIME)-$(LATEST_COMMIT)
INDEXER_LATEST  = $(REGISTRY_HOST)/$(INDEXER_IMAGE)$(ENVIRONMENT):$(IMAGE_TAG)

FRONTEND_BACKUP = $(REGISTRY_HOST)/$(FRONTEND_IMAGE)$(ENVIRONMENT):$(CURRENT_DATE_TIME)-$(LATEST_COMMIT)
FRONTEND_LATEST = $(REGISTRY_HOST)/$(FRONTEND_IMAGE)$(ENVIRONMENT):$(IMAGE_TAG)
