module TenantManagement
  class Error < StandardError
    attr_reader :code, :status, :fields
    def initialize(code, message, status: 422, fields: {})
      super(message)
      @code, @status, @fields = code, status, fields
    end
  end
end
