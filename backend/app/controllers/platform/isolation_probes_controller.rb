module Platform
  class IsolationProbesController < ApplicationController
    def show
      TenantContext.with(actor: current_administrator, tenant_id: params[:id]) do
        raise "Synthetic context failure" if params[:fail] == "true"
        render json: { data: TenantData::IsolationMarker.order(:id).pluck(:value) }
      end
    rescue TenantManagement::Error => error
      render json: { error: { code: error.code } }, status: error.status
    rescue ActiveRecord::RecordNotFound
      head :not_found
    end
  end
end
