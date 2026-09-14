#!/usr/bin/env bash
set -euo pipefail

CLUSTER="borrmann-dev"
NAMESPACE="knowledge-hub-staging"
RELEASE="knowledge-hub"
CHART_DIR="$(dirname "$0")"

usage() {
    cat <<EOF
Usage: $(basename "$0") <install|upgrade|delete>

  install   Install the release (or upgrade if already present)
  upgrade   Upgrade the release
  delete    Delete the release (keeps PVCs)

Requires a kubeconfig context named '${CLUSTER}'.
Run 'secrets.sh write' first to set credentials in the cluster.
EOF
    exit 1
}

check_context() {
    local current
    current=$(kubectl config current-context 2>/dev/null || true)
    if [[ "${current}" != "${CLUSTER}" ]]; then
        echo "ERROR: current kubectl context is '${current}', expected '${CLUSTER}'" >&2
        echo "       Switch with: kubectl config use-context ${CLUSTER}" >&2
        exit 1
    fi
}

cmd_install() {
    check_context
    helm upgrade --install "${RELEASE}" "${CHART_DIR}" \
        --namespace "${NAMESPACE}" \
        --create-namespace \
        --values "${CHART_DIR}/values-staging.yaml" \
        --wait \
        --timeout=5m \
        "$@"
    echo ""
    echo "Deployed. Check: kubectl -n ${NAMESPACE} get all,ingress,pvc"
}

cmd_upgrade() {
    check_context
    helm upgrade "${RELEASE}" "${CHART_DIR}" \
        --namespace "${NAMESPACE}" \
        --values "${CHART_DIR}/values-staging.yaml" \
        --wait \
        --timeout=5m \
        "$@"
    echo ""
    echo "Upgraded. Check: kubectl -n ${NAMESPACE} get all,ingress,pvc"
}

cmd_delete() {
    check_context
    helm uninstall "${RELEASE}" --namespace "${NAMESPACE}" || true
    echo ""
    read -r -p "Delete PVCs as well? [y/N] " DELETE_PVCS
    if [[ "${DELETE_PVCS}" =~ ^[Yy]$ ]]; then
        kubectl -n "${NAMESPACE}" delete pvc --all
        echo "PVCs deleted."
    else
        echo "PVCs preserved."
    fi
}

case "${1:-}" in
    install)  cmd_install "${@:2}" ;;
    upgrade)  cmd_upgrade "${@:2}" ;;
    delete)   cmd_delete ;;
    *)        usage ;;
esac
