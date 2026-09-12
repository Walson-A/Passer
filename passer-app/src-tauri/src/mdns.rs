use crate::device;
use crate::types::SERVER_PORT;

pub fn init_mdns() {
    std::thread::spawn(|| {
        if let Ok(mdns) = mdns_sd::ServiceDaemon::new() {
            // Both the instance and the host are derived from the machine name,
            // so two Passer PCs on one network never claim the same address.
            let label = device::mdns_label();
            let service_type = "_passer._tcp.local.";
            let host_name = format!("{}.local.", label);
            let device_id = device::load_or_create_device_id();

            // Published so a future discovery flow can identify a specific PC
            // from the browse results alone, without connecting first.
            let properties = [
                ("version", "1.0"),
                ("id", device_id.as_str()),
                ("name", label.as_str()),
            ];

            let my_ip = local_ip_address::local_ip().unwrap_or("127.0.0.1".parse().unwrap());

            if let Ok(service_info) = mdns_sd::ServiceInfo::new(
                service_type,
                &label,
                &host_name,
                my_ip.to_string().as_str(),
                SERVER_PORT,
                &properties[..],
            ) {
                if let Err(e) = mdns.register(service_info) {
                    eprintln!("mDNS Register Error: {}", e);
                } else {
                    println!("mDNS Service Registered: {}.{} -> {}", label, service_type, host_name);
                }

                // Keep the daemon alive
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        }
    });
}
