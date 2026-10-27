module Platform
  class RetentionController < ManagementController
    def show
      render json:{data:TenantManagement::RetentionDeletion.eligibility(@actor,record)}
    end
    def update
      values = params.require(:clearances).permit(*TenantManagement::RetentionDeletion::REVIEW_FIELDS,:retention_policy_reference).to_h
      render json:{data:TenantManagement::RetentionDeletion.review!(@actor,record,values,params[:review_note])}
    end
    def destroy
      TenantManagement::RetentionDeletion.delete!(@actor,record,params[:password],params[:confirmation])
      head :no_content
    end
    private
    def record
      @record ||= Access.new.scope(@actor).find(params[:tenant_id])
    end
  end
end
