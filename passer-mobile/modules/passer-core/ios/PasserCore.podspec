Pod::Spec.new do |s|
  s.name           = 'PasserCore'
  s.version        = '0.1.0'
  s.summary        = 'passer-core (device network) for the Passer iPhone app'
  s.description    = 'Swift module wrapping the UniFFI bindings of passer-ffi.'
  s.license        = 'MIT OR Apache-2.0'
  s.author         = 'Walson'
  s.homepage       = 'https://github.com/Walson-A/passer-core'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Walson-A/passer-core.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # PasserCoreModule.swift, plus the generated vendor/passer_ffi.swift.
  s.source_files = '*.swift', 'vendor/*.swift'
  # The Rust library, with the C header and module map of the generated bindings.
  s.vendored_frameworks = 'vendor/PasserFFI.xcframework'
  s.frameworks = 'Security', 'SystemConfiguration'
  s.libraries = 'resolv'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
