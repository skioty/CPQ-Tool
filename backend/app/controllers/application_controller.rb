class ApplicationController < ActionController::API
  include ActionController::Cookies
  include ActionController::RequestForgeryProtection
  include Devise::Controllers::Helpers
  protect_from_forgery with: :exception, prepend: true
  before_action { response.set_header("Cache-Control", "no-store") }
  before_action :require_second_factor
  private
  def require_second_factor
    return unless Platform::AccountSecurity.enforced?
    public_actions = {
      "platform/sessions"=>%w[csrf create destroy], "tenant_access/sessions"=>%w[create destroy],
      "platform/factors"=>%w[show create destroy], "platform/invitation_acceptances"=>%w[preview create],
      "platform/microsoft"=>%w[status start callback]
    }
    return if public_actions.fetch(controller_path,[]).include?(action_name)
    identity = current_administrator ? ["administrator",current_administrator] : current_tenant_user ? ["tenant_user",current_tenant_user] : nil
    return unless identity
    unless session[:mfa_verified_for] == "#{identity[0]}:#{identity[1].id}" && identity[1].totp_secret_ciphertext.present?
      render json:{error:{code:"two_factor_required",message:"Sign in and verify your authenticator to continue.",fields:{}}},status:401
    end
  end
  public
  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: { code: "invalid_csrf", message: "Refresh your session and retry", fields: {}, request_id: request.request_id } }, status: 422
  end
end
