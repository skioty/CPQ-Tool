require "open3"
require "timeout"
module TenantManagement
  class ImageValidator
    def self.read!(upload, kind)
      invalid = -> { raise Error.new("validation_failed", "Invalid image", fields: { kind => ["Use an allowed image format, dimensions and file size"] }) }
      invalid.call unless %w[logo favicon].include?(kind) && upload.respond_to?(:read)
      limit = kind == "logo" ? 2 * 1024 * 1024 : 500 * 1024
      bytes = upload.read(limit + 1)
      invalid.call if bytes.empty? || bytes.bytesize > limit
      format, mime = if bytes.start_with?("\x89PNG\r\n\x1a\n".b)
        ["png", "image/png"]
      elsif bytes.start_with?("\xff\xd8\xff".b)
        ["jpeg", "image/jpeg"]
      elsif bytes.start_with?("RIFF") && bytes[8,4] == "WEBP"
        ["webp", "image/webp"]
      elsif bytes.start_with?("\x00\x00\x01\x00".b)
        ["ico", "image/vnd.microsoft.icon"]
      end
      invalid.call unless (kind == "logo" ? %w[png jpeg webp] : %w[png ico]).include?(format)
      # Decode actual bytes with fixed decoder/arguments, never user filenames or shell interpolation.
      output, _error, status = Open3.capture3("convert", "-regard-warnings", "-limit", "memory", "32MiB",
        "-limit", "map", "64MiB", "-limit", "disk", "0", "-limit", "time", "5",
        "#{format}:-", "-format", "%w %h\n", "info:", stdin_data: bytes, binmode: true)
      dimensions = output.lines.map { |line| line.split.map(&:to_i) }
      invalid.call unless status.success? && dimensions.any? && dimensions.all? { |w,h|
        kind == "logo" ? w.between?(1,2048) && h.between?(1,2048) : w == h && [16,32,48,64,128,256].include?(w) }
      [bytes, mime]
    end
  end
end
