module Platform
  class Administrator < ApplicationRecord
    self.table_name = "public.platform_administrators"
    devise :database_authenticatable, :validatable, :timeoutable
    validates :role, inclusion: { in: %w[super_admin admin] }
    def active_for_authentication? = super && enabled?
    def super_admin? = role == "super_admin"
  end
end
