pub fn init_mdns() {
    std::thread::spawn(|| {
        if let Ok(mdns) = mdns_sd::ServiceDaemon::new() {
            // Advertise "passer.local" service
            // Service Type: _passer._tcp.local.
            // Instance Name: passer
            // Port: 8000
            let service_type = "_passer._tcp.local.";
            let instance_name = "passer";
            let host_name = "passer.local.";
            let port = 8000;
            let properties = [("version", "1.0")];

            let my_ip = local_ip_address::local_ip().unwrap_or("127.0.0.1".parse().unwrap());
            
            // Create service info
            if let Ok(service_info) = mdns_sd::ServiceInfo::new(
                service_type,
                instance_name,
                host_name,
                my_ip.to_string().as_str(),
                port,
                &properties[..]
            ) {
                if let Err(e) = mdns.register(service_info) {
                    eprintln!("mDNS Register Error: {}", e);
                } else {
                    println!("mDNS Service Registered: {}.{} -> {}", instance_name, service_type, host_name);
                }
                
                // Keep the daemon alive
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        }
    });
}
