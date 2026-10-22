class ApplicationController < ActionController::API
  include ActionController::Cookies
  include ActionController::RequestForgeryProtection
  include Devise::Controllers::Helpers
  protect_from_forgery with: :exception, prepend: true
  before_action { response.set_header("Cache-Control", "no-store") }
  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: { code: "invalid_csrf", message: "Refresh your session and retry", fields: {}, request_id: request.request_id } }, status: 422
  end
end
