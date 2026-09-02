"""Batch 8: cfg 71-82. Physical layer, IoT, M2M and security frameworks."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]


# -------------------------------------------------- cfg 71, UML_COMPONENT
def physical_layer_components():
    d = Diagram("Halden Campus - Physical Layer Component View",
                "UML component diagram (model answer)")
    d.shape("host", "HostNic", "component", 40, 140, 200, 70)
    d.shape("copper", "CopperTransceiver", "component", 320, 90, 210, 70)
    d.shape("fibre", "FibreTransceiver", "component", 320, 210, 210, 70)
    d.shape("media", "MediaAdapter", "component", 320, 340, 210, 70)
    d.shape("patch", "PatchPanelPort", "component", 620, 140, 210, 70)
    d.shape("switch", "AccessSwitchPort", "component", 900, 140, 210, 70)
    d.shape("poe", "PoeInjector", "component", 620, 300, 210, 70)
    d.shape("test", "CableCertifier", "component", 620, 440, 210, 70)
    d.shape("dom", "OpticalMonitor", "component", 900, 300, 210, 70)
    d.shape("mon", "PlantRecords", "component", 900, 440, 210, 70)
    d.shape("i_sig", "IPhysicalSignal", "provided", 285, 105, 22, 22)
    d.shape("i_opt", "IOpticalSignal", "provided", 285, 225, 22, 22)
    d.shape("i_media", "IMediaIndependent", "provided", 285, 355, 22, 22)
    d.shape("i_link", "ILinkTermination", "provided", 585, 155, 22, 22)
    d.shape("i_pwr", "IInlinePower", "provided", 585, 315, 22, 22)
    d.shape("i_rec", "IPlantRecord", "provided", 865, 455, 22, 22)
    d.edge("host", "media", "dep", "IMediaIndependent")
    d.edge("media", "copper", "dep", "IPhysicalSignal")
    d.edge("media", "fibre", "dep", "IOpticalSignal")
    d.edge("copper", "patch", "dep", "ILinkTermination")
    d.edge("fibre", "patch", "dep", "ILinkTermination")
    d.edge("patch", "switch", "dep", "ILinkTermination")
    d.edge("poe", "patch", "dep", "IInlinePower")
    d.edge("test", "patch", "dep", "certifies")
    d.edge("dom", "fibre", "dep", "reads diagnostics")
    d.edge("test", "mon", "dep", "IPlantRecord")
    d.edge("dom", "mon", "dep", "IPlantRecord")
    d.legend(COMPONENT_LEGEND + ["adapter hides the medium from the host"],
             x=40, y=340)
    return d.xml()


CFG71_Q = """\
"Halden Campus" - Physical Layer Architecture

Halden runs copper to the desk and fibre between buildings, and wants a host to \
be unaware of which it is attached to. Model the component architecture.

a) A host NIC depends on one media-independent interface only. It never knows \
whether the medium is copper or fibre.
b) The media adapter provides IMediaIndependent to the host and hides the \
medium below it.
c) The copper transceiver provides IPhysicalSignal and the fibre transceiver \
provides IOpticalSignal. The media adapter depends on both.
d) Both transceivers terminate at a patch panel port through ILinkTermination.
e) The patch panel port presents that same ILinkTermination interface onward to \
the access switch port.
f) A PoE injector supplies the patch panel port through IInlinePower. Nothing \
else supplies power.
g) A cable certifier certifies the patch panel port, and an optical monitor \
reads diagnostics from the fibre transceiver. Neither is in the traffic path.
h) The certifier and the optical monitor both write to plant records through \
IPlantRecord. Nothing depends on plant records.
i) No component below the media adapter depends on the host NIC."""

CFG71_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (b) is the reason the media adapter exists. Explain in one \
sentence what adding a third medium would cost in this design, and which \
components would have to change.
5. Requirement (g) says neither tool is in the traffic path. Mark them on your \
diagram, and state in one sentence why keeping test equipment out of the traffic \
path matters at the physical layer."""


# -------------------------------------------------- cfg 72, UML_COMPONENT
def iot_standards_stack():
    d = Diagram("Fenland Water - IoT Standards Stack",
                "UML component diagram (model answer)")
    d.shape("sensor", "ConstrainedSensor", "component", 40, 140, 210, 70)
    d.shape("radio", "LowPowerRadio", "component", 320, 140, 210, 70)
    d.shape("adapt", "SixLowpanAdapter", "component", 600, 140, 220, 70)
    d.shape("route", "MeshRouter", "component", 880, 140, 210, 70)
    d.shape("border", "BorderRouter", "component", 1160, 140, 210, 70)
    d.shape("coap", "CoapEndpoint", "component", 600, 300, 220, 70)
    d.shape("dtls", "DtlsSecurity", "component", 880, 300, 210, 70)
    d.shape("rd", "ResourceDirectory", "component", 1160, 300, 210, 70)
    d.shape("proxy", "HttpCoapProxy", "component", 880, 450, 210, 70)
    d.shape("cloud", "CloudApplication", "component", 1160, 450, 210, 70)
    d.shape("i_phy", "IRadioLink", "provided", 285, 155, 22, 22)
    d.shape("i_6lo", "IIpv6Datagram", "provided", 565, 155, 22, 22)
    d.shape("i_mesh", "IMeshForward", "provided", 845, 155, 22, 22)
    d.shape("i_coap", "IResourceAccess", "provided", 565, 315, 22, 22)
    d.shape("i_dtls", "ISecureChannel", "provided", 845, 315, 22, 22)
    d.shape("i_rd", "IResourceDiscovery", "provided", 1125, 315, 22, 22)
    d.edge("sensor", "radio", "dep", "IRadioLink")
    d.edge("radio", "adapt", "dep", "IIpv6Datagram")
    d.edge("adapt", "route", "dep", "IMeshForward")
    d.edge("route", "border", "dep", "IMeshForward")
    d.edge("sensor", "coap", "dep", "IResourceAccess")
    d.edge("coap", "dtls", "dep", "ISecureChannel")
    d.edge("coap", "rd", "dep", "IResourceDiscovery")
    d.edge("proxy", "coap", "dep", "IResourceAccess")
    d.edge("cloud", "proxy", "dep", "HTTP")
    d.legend(COMPONENT_LEGEND + ["each layer knows only the one below it"],
             x=40, y=300)
    return d.xml()


CFG72_Q = """\
"Fenland Water" - IoT Standards Stack

Fenland's field devices are battery powered and cannot run a full IP stack, but \
a cloud application must still address them individually. Model the component \
architecture that reconciles that.

a) A constrained sensor sends over a low-power radio through IRadioLink. It \
knows nothing above the radio.
b) The 6LoWPAN adapter provides IIpv6Datagram, compressing IPv6 so it fits the \
radio's frame size. The radio depends on it.
c) A mesh router provides IMeshForward. The adapter forwards through it, and the \
router forwards on to the border router through that same interface.
d) The border router is the only component that faces the wider network.
e) The sensor accesses application resources through the CoAP endpoint's \
IResourceAccess interface.
f) The CoAP endpoint secures its traffic through the DTLS component's \
ISecureChannel interface. No component implements its own transport security.
g) The CoAP endpoint registers and finds resources through the resource \
directory's IResourceDiscovery interface.
h) An HTTP-to-CoAP proxy consumes IResourceAccess -- the same interface the \
sensor uses -- and the cloud application talks plain HTTP to that proxy. The \
cloud application never speaks CoAP.
i) No component depends on a component above it in this stack."""

CFG72_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (h) has two consumers of IResourceAccess. Explain in one sentence \
what the proxy buys the cloud application, and what would have to change in the \
cloud application if the proxy were removed.
5. Requirement (b) exists because of a frame-size limit. State in one sentence \
what 6LoWPAN does to make IPv6 fit, and what the opening paragraph's \
"individually addressable" requirement would cost without it."""


# -------------------------------------------------- cfg 73, UML_COMPONENT
def m2m_edge_pipeline():
    d = Diagram("Calder Industrial - Edge Analytics Pipeline",
                "UML component diagram (model answer)")
    d.shape("machine", "MachineController", "component", 40, 150, 210, 70)
    d.shape("collect", "EdgeCollector", "component", 320, 150, 210, 70)
    d.shape("filter", "SamplingFilter", "component", 320, 300, 210, 70)
    d.shape("infer", "EdgeInference", "component", 600, 300, 210, 70)
    d.shape("store", "LocalRingBuffer", "component", 600, 150, 210, 70)
    d.shape("sync", "CloudSyncAgent", "component", 880, 150, 210, 70)
    d.shape("model", "ModelDistributor", "component", 880, 300, 210, 70)
    d.shape("cloud", "CloudIngest", "component", 1160, 150, 210, 70)
    d.shape("registry", "ModelRegistry", "component", 1160, 300, 210, 70)
    d.shape("alert", "LocalAlarmPanel", "component", 600, 450, 210, 70)
    d.shape("i_tag", "ITagStream", "provided", 285, 165, 22, 22)
    d.shape("i_filt", "ISampledStream", "provided", 285, 315, 22, 22)
    d.shape("i_buf", "IBufferWrite", "provided", 565, 165, 22, 22)
    d.shape("i_inf", "IInferenceResult", "provided", 565, 315, 22, 22)
    d.shape("i_ing", "ITelemetryIngest", "provided", 1125, 165, 22, 22)
    d.shape("i_reg", "IModelFetch", "provided", 1125, 315, 22, 22)
    d.edge("collect", "machine", "dep", "ITagStream")
    d.edge("collect", "filter", "dep", "ISampledStream")
    d.edge("filter", "infer", "dep", "ISampledStream")
    d.edge("infer", "store", "dep", "IBufferWrite")
    d.edge("infer", "alert", "dep", "IInferenceResult")
    d.edge("sync", "store", "dep", "IBufferWrite")
    d.edge("sync", "cloud", "dep", "ITelemetryIngest")
    d.edge("model", "registry", "dep", "IModelFetch")
    d.edge("model", "infer", "dep", "deploys model to")
    d.legend(COMPONENT_LEGEND + ["alarms are decided at the edge, not the cloud"],
             x=40, y=300)
    return d.xml()


CFG73_Q = """\
"Calder Industrial" - Edge Analytics Pipeline

Calder's plant link drops for hours at a time, and a machine fault must raise an \
alarm within a second regardless. Model the component architecture.

a) The machine controller provides ITagStream. The edge collector is the only \
component that reads from it.
b) The collector passes readings to the sampling filter, which provides \
ISampledStream and reduces the data rate before anything downstream sees it.
c) Edge inference consumes ISampledStream and evaluates the model locally.
d) Edge inference raises alarms directly to the local alarm panel through \
IInferenceResult. That path does not involve the cloud.
e) Edge inference writes results to the local ring buffer through IBufferWrite. \
The buffer holds data while the link is down.
f) The cloud sync agent reads from that same IBufferWrite component and \
forwards to cloud ingest through ITelemetryIngest.
g) The model distributor fetches models from the model registry through \
IModelFetch and deploys them to edge inference. Edge inference never contacts \
the registry itself.
h) No component at the edge depends on cloud ingest, and no cloud component \
depends on the machine controller."""

CFG73_I = """\
1. Draw every component in requirements (a) to (g) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (d) is what meets the one-second alarm target. Trace that path on \
your diagram, name every component on it, and state in one sentence why routing \
the alarm through the cloud would fail the target.
5. Requirement (e) is what survives the link outage. Explain in one sentence \
what the ring buffer does when it fills before the link returns, and what design \
decision that forces."""


# -------------------------------------------------- cfg 74, UML_COMPONENT
def load_balanced_service():
    d = Diagram("Halden Campus - Highly Available Service Architecture",
                "UML component diagram (model answer)")
    d.shape("client", "CampusClient", "component", 40, 160, 200, 70)
    d.shape("gslb", "GlobalLoadBalancer", "component", 300, 160, 210, 70)
    d.shape("lb1", "SiteLoadBalancerA", "component", 570, 90, 220, 70)
    d.shape("lb2", "SiteLoadBalancerB", "component", 570, 240, 220, 70)
    d.shape("app1", "AppServerPoolA", "component", 850, 90, 210, 70)
    d.shape("app2", "AppServerPoolB", "component", 850, 240, 210, 70)
    d.shape("cache", "SharedCache", "component", 1120, 90, 210, 70)
    d.shape("dbp", "DatabasePrimary", "component", 1120, 240, 210, 70)
    d.shape("dbr", "DatabaseReplica", "component", 1120, 390, 210, 70)
    d.shape("health", "HealthProbe", "component", 570, 390, 220, 70)
    d.shape("i_gslb", "ISiteSelection", "provided", 265, 175, 22, 22)
    d.shape("i_lb", "IRequestDistribution", "provided", 535, 105, 22, 22)
    d.shape("i_app", "IApplicationService", "provided", 815, 105, 22, 22)
    d.shape("i_cache", "ICacheAccess", "provided", 1085, 105, 22, 22)
    d.shape("i_write", "IWriteAccess", "provided", 1085, 255, 22, 22)
    d.shape("i_read", "IReadAccess", "provided", 1085, 405, 22, 22)
    d.edge("client", "gslb", "dep", "ISiteSelection")
    d.edge("gslb", "lb1", "dep", "IRequestDistribution")
    d.edge("gslb", "lb2", "dep", "IRequestDistribution")
    d.edge("lb1", "app1", "dep", "IApplicationService")
    d.edge("lb2", "app2", "dep", "IApplicationService")
    d.edge("app1", "cache", "dep", "ICacheAccess")
    d.edge("app2", "cache", "dep", "ICacheAccess")
    d.edge("app1", "dbp", "dep", "IWriteAccess")
    d.edge("app2", "dbp", "dep", "IWriteAccess")
    d.edge("app1", "dbr", "dep", "IReadAccess")
    d.edge("app2", "dbr", "dep", "IReadAccess")
    d.edge("dbp", "dbr", "dep", "replicates to")
    d.edge("health", "app1", "dep", "probes")
    d.edge("health", "app2", "dep", "probes")
    d.edge("health", "gslb", "dep", "reports to")
    d.legend(COMPONENT_LEGEND + ["writes go to one primary; reads may go to a replica"],
             x=40, y=380)
    return d.xml()


CFG74_Q = """\
"Halden Campus" - Highly Available Service

Halden's student portal goes down whenever the single application server \
restarts. Model an architecture that survives losing a server, and then a whole \
site.

a) A campus client reaches only the global load balancer, which provides \
ISiteSelection.
b) The global load balancer distributes across two site load balancers, A and B, \
both providing IRequestDistribution.
c) Each site load balancer serves its own application server pool through \
IApplicationService. A site load balancer never reaches the other site's pool.
d) Both pools use one shared cache through ICacheAccess.
e) All writes from both pools go to the single database primary through \
IWriteAccess. There is exactly one primary.
f) Reads may go to the database replica through IReadAccess. The primary \
replicates to the replica.
g) A health probe probes both application pools and reports to the global load \
balancer, which stops sending traffic to an unhealthy site.
h) No application pool depends on a load balancer, and nothing depends on the \
health probe."""

CFG74_I = """\
1. Draw every component in requirements (a) to (g) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (e) says exactly one primary. Mark it on your diagram as the \
single point of failure, and explain in one sentence why the design accepts one \
here but not in the application tier.
5. Work through requirement (g): a server in pool A fails, then the whole of \
site A fails. State which component detects each, and what the client \
experiences in each case."""


# -------------------------------------------------- cfg 75, UML_COMPONENT
def device_provisioning():
    d = Diagram("Fenland Water - Device Provisioning and Lifecycle",
                "UML component diagram (model answer)")
    d.shape("device", "UnprovisionedDevice", "component", 40, 150, 220, 70)
    d.shape("boot", "BootstrapService", "component", 330, 150, 210, 70)
    d.shape("ca", "CertificateAuthority", "component", 330, 300, 220, 70)
    d.shape("reg", "DeviceRegistry", "component", 620, 150, 210, 70)
    d.shape("policy", "ProvisioningPolicy", "component", 620, 300, 210, 70)
    d.shape("conf", "ConfigurationService", "component", 900, 150, 220, 70)
    d.shape("ota", "FirmwareService", "component", 900, 300, 220, 70)
    d.shape("broker", "TelemetryBroker", "component", 1190, 150, 210, 70)
    d.shape("revoke", "RevocationList", "component", 620, 450, 210, 70)
    d.shape("audit", "ProvisioningAudit", "component", 900, 450, 220, 70)
    d.shape("i_boot", "IBootstrapEnrol", "provided", 295, 165, 22, 22)
    d.shape("i_ca", "ICertificateIssue", "provided", 295, 315, 22, 22)
    d.shape("i_reg", "IDeviceIdentity", "provided", 585, 165, 22, 22)
    d.shape("i_pol", "IPolicyLookup", "provided", 585, 315, 22, 22)
    d.shape("i_conf", "IConfigFetch", "provided", 865, 165, 22, 22)
    d.shape("i_rev", "IRevocationCheck", "provided", 585, 465, 22, 22)
    d.edge("device", "boot", "dep", "IBootstrapEnrol")
    d.edge("boot", "ca", "dep", "ICertificateIssue")
    d.edge("boot", "reg", "dep", "IDeviceIdentity")
    d.edge("boot", "policy", "dep", "IPolicyLookup")
    d.edge("device", "conf", "dep", "IConfigFetch")
    d.edge("device", "ota", "dep", "IFirmwareDownload")
    d.edge("device", "broker", "dep", "publishes to")
    d.edge("broker", "reg", "dep", "IDeviceIdentity")
    d.edge("broker", "revoke", "dep", "IRevocationCheck")
    d.edge("ca", "revoke", "dep", "IRevocationCheck")
    d.edge("boot", "audit", "dep", "records to")
    d.legend(COMPONENT_LEGEND + ["a device holds no credential before enrolment"],
             x=40, y=300)
    return d.xml()


CFG75_Q = """\
"Fenland Water" - Device Provisioning and Lifecycle

Fenland ships devices to sites with no credentials on them, and must be able to \
cut a stolen device off the network. Model the component architecture.

a) An unprovisioned device holds no credential. It contacts the bootstrap \
service through IBootstrapEnrol and nothing else.
b) The bootstrap service obtains a device certificate from the certificate \
authority through ICertificateIssue. No other component issues certificates.
c) The bootstrap service registers the device with the device registry through \
IDeviceIdentity, and reads the applicable rules from the provisioning policy \
through IPolicyLookup.
d) The bootstrap service records every enrolment to the provisioning audit \
component.
e) Once enrolled, the device fetches its settings from the configuration service \
through IConfigFetch and its firmware through the firmware service's \
IFirmwareDownload interface.
f) The device publishes telemetry to the telemetry broker. The broker verifies \
the device through the registry's IDeviceIdentity interface -- the same one the \
bootstrap service used.
g) The broker and the certificate authority both check the revocation list \
through IRevocationCheck.
h) No component depends on a device, and nothing depends on the provisioning \
audit."""

CFG75_I = """\
1. Draw every component in requirements (a) to (g) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (a) says the device holds no credential before enrolment. Explain \
in one sentence what the bootstrap service must therefore use to decide the \
device is genuine, and why that is the weakest point in the design.
5. Answer the second problem in the opening paragraph: trace on your diagram \
what happens when a stolen device is revoked, naming every component involved, \
and state which single component stops its telemetry."""


# ------------------------------------------------------------ cfg 76, ERD
def iot_platform_records():
    d = Diagram("Fenland Water - IoT Platform Records",
                "Entity-relationship diagram (model answer)")
    d.node("tenant", "Tenant", ["PK tenantId: String", "name: String",
                                "contractRef: String"], 40, 90)
    d.node("fleet", "Fleet", ["PK fleetId: String", "FK tenantId: String",
                              "name: String", "region: String"], 320, 90)
    d.node("device", "Device", ["PK deviceId: String", "FK fleetId: String",
                                "FK typeId: String", "serialNumber: String",
                                "enrolledOn: Date"], 620, 90)
    d.node("dtype", "DeviceType", ["PK typeId: String", "manufacturer: String",
                                   "modelName: String",
                                   "protocolStandard: String"], 900, 90)
    d.node("cert", "DeviceCertificate", ["PK certificateId: String",
                                         "FK deviceId: String", "serial: String",
                                         "issuedOn: Date", "expiresOn: Date",
                                         "revokedOn: Date"], 620, 300)
    d.node("cap", "Capability", ["PK capabilityId: String", "FK typeId: String",
                                 "name: String", "dataType: String",
                                 "isWritable: boolean"], 900, 300)
    d.node("res", "DeviceResource", ["PK resourceId: String", "FK deviceId: String",
                                     "FK capabilityId: String", "uriPath: String"],
           620, 520)
    d.node("obs", "Observation", ["PK observationId: long", "FK resourceId: String",
                                  "observedAt: Date", "value: String"], 320, 520)
    d.node("sub", "Subscription", ["PK subscriptionId: String", "FK resourceId: String",
                                   "FK consumerId: String", "createdOn: Date",
                                   "minIntervalSec: int"], 320, 300)
    d.node("consumer", "Consumer", ["PK consumerId: String", "FK tenantId: String",
                                    "name: String", "callbackUrl: String"], 40, 300)
    d.edge("tenant", "fleet", "comp", "owns", "1", "1..*")
    d.edge("fleet", "device", "comp", "contains", "1", "0..*")
    d.edge("dtype", "device", "assoc", "specifies", "1", "0..*")
    d.edge("device", "cert", "comp", "is identified by", "1", "1..*")
    d.edge("dtype", "cap", "comp", "declares", "1", "1..*")
    d.edge("device", "res", "comp", "exposes", "1", "1..*")
    d.edge("cap", "res", "assoc", "is realised as", "1", "0..*")
    d.edge("res", "obs", "comp", "records", "1", "0..*")
    d.edge("res", "sub", "comp", "is watched by", "1", "0..*")
    d.edge("consumer", "sub", "assoc", "places", "1", "0..*")
    d.edge("tenant", "consumer", "comp", "authorises", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=520)
    return d.xml()


CFG76_Q = """\
"Fenland Water" - IoT Platform Records

Fenland runs one platform for several water companies and must never let one \
see another's devices. Model the data.

a) A tenant has a name and a contract reference, and owns one or more fleets. A \
fleet belongs to exactly one tenant and does not survive it.
b) A fleet contains any number of devices. A device belongs to exactly one \
fleet.
c) A device type has a manufacturer, a model name and a protocol standard, and \
is a shared catalogue. A device is specified by exactly one type; types outlive \
any device.
d) A device is identified by one or more device certificates, each with a \
serial, an issue date, an expiry date and a revocation date that is empty until \
it is revoked. Certificates are deleted with the device.
e) A device type declares one or more capabilities, each with a name, a data \
type and a writable flag. A capability has no meaning apart from its type.
f) A device exposes one or more device resources. Each realises exactly one \
capability of the device's type and has a URI path.
g) A resource records any number of observations, each with a timestamp and a \
value.
h) A consumer is authorised by exactly one tenant and has a name and a callback \
URL.
i) A resource is watched by any number of subscriptions. Each is placed by \
exactly one consumer and records a creation date and a minimum interval."""

CFG76_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Answer the isolation requirement in the opening paragraph: trace on your \
diagram the path from a consumer to an observation, and name every entity that \
must be checked to prove the consumer's tenant owns that device.
4. Requirement (f) links a device's resource to its type's capability. Explain \
in one sentence why the capability is defined on the TYPE rather than on the \
device, and what would be duplicated if it were not.
5. Requirement (d) keeps expired and revoked certificates rather than deleting \
them. State in one sentence what question that answers, and how you would find \
the certificate that is currently valid."""


# ------------------------------------------------------------ cfg 77, ERD
def threat_modelling_records():
    d = Diagram("Pellworth Bank - Threat Modelling Records",
                "Entity-relationship diagram (model answer)")
    d.node("system", "System", ["PK systemId: String", "name: String",
                                "FK ownerId: String", "criticality: String"], 40, 90)
    d.node("owner", "SystemOwner", ["PK ownerId: String", "fullName: String",
                                    "department: String"], 40, 320)
    d.node("model", "ThreatModel", ["PK threatModelId: String", "FK systemId: String",
                                    "version: String", "producedOn: Date",
                                    "methodology: String"], 320, 90)
    d.node("element", "SystemElement", ["PK elementId: String",
                                        "FK threatModelId: String", "name: String",
                                        "elementType: String"], 320, 320)
    d.node("flow", "DataFlow", ["PK dataFlowId: String", "FK threatModelId: String",
                                "FK sourceElementId: String",
                                "FK targetElementId: String",
                                "protocol: String", "crossesBoundary: boolean"],
           320, 540)
    d.node("boundary", "TrustBoundary", ["PK boundaryId: String",
                                         "FK threatModelId: String", "name: String",
                                         "description: String"], 620, 540)
    d.node("threat", "IdentifiedThreat", ["PK threatId: String",
                                          "FK dataFlowId: String",
                                          "FK categoryId: String",
                                          "description: String",
                                          "identifiedOn: Date"], 620, 320)
    d.node("category", "ThreatCategory", ["PK categoryId: String", "code: String",
                                          "name: String"], 620, 90)
    d.node("rating", "ThreatRating", ["PK ratingId: String", "FK threatId: String",
                                      "likelihood: int", "impact: int",
                                      "ratedOn: Date", "isCurrent: boolean"],
           900, 320)
    d.node("mitigation", "Mitigation", ["PK mitigationId: String", "FK threatId: String",
                                        "FK controlId: String", "status: String",
                                        "residualRating: int"], 900, 90)
    d.node("control", "Control", ["PK controlId: String", "reference: String",
                                  "name: String"], 1180, 90)
    d.edge("owner", "system", "assoc", "owns", "1", "0..*")
    d.edge("system", "model", "comp", "is modelled by", "1", "1..*")
    d.edge("model", "element", "comp", "contains", "1", "1..*")
    d.edge("model", "boundary", "comp", "defines", "1", "0..*")
    d.edge("model", "flow", "comp", "maps", "1", "1..*")
    d.edge("element", "flow", "assoc", "is an end of", "1", "0..*")
    d.edge("flow", "threat", "comp", "attracts", "1", "0..*")
    d.edge("category", "threat", "assoc", "classifies", "1", "0..*")
    d.edge("threat", "rating", "comp", "is rated as", "1", "1..*")
    d.edge("threat", "mitigation", "comp", "is mitigated by", "1", "0..*")
    d.edge("control", "mitigation", "assoc", "is applied as", "1", "0..*")
    d.legend(ERD_LEGEND, x=1180, y=320)
    return d.xml()


CFG77_Q = """\
"Pellworth Bank" - Threat Modelling Records

Pellworth threat-models each release but keeps the results in slide decks, so \
nobody can say which threats from last year are still open. Model the data.

a) A system has a name and a criticality and is owned by exactly one system \
owner. Owners remain on file after a system is retired.
b) A system is modelled by one or more threat models, each with a version, a \
production date and the methodology used. A model has no meaning apart from its \
system.
c) A threat model contains one or more system elements, each with a name and a \
type (process, data store, external entity). Elements are deleted with the \
model.
d) A threat model defines any number of trust boundaries, each with a name and a \
description.
e) A threat model maps one or more data flows. A flow has a source element and a \
target element -- both from the same model -- a protocol, and a flag saying \
whether it crosses a trust boundary.
f) A threat category has a code and a name and is a standing list shared across \
all models.
g) A data flow attracts any number of identified threats. Each is classified by \
exactly one category and records a description and the date identified.
h) A threat is rated as one or more threat ratings, each with a likelihood, an \
impact, the date rated and a current-row flag. Ratings are never overwritten.
i) A threat is mitigated by any number of mitigations, each applying exactly one \
control and recording a status and a residual rating."""

CFG77_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (e) has two foreign keys to the SAME entity. Show both, and name \
them so the source role and the target role are distinguishable.
4. Answer the question in the opening paragraph: name the two entities and the \
single attribute you would query to list last year's threats that are still \
open, and trace the path on your diagram.
5. Requirement (h) keeps every rating. Explain in one sentence why a rating \
belongs to a threat rather than to a data flow, and how you would find the \
rating that currently stands."""


# -------------------------------------------------- cfg 78, UML_COMPONENT
def grc_platform():
    d = Diagram("Pellworth Bank - Governance, Risk and Compliance Platform",
                "UML component diagram (model answer)")
    d.shape("portal", "GrcPortal", "component", 40, 150, 200, 70)
    d.shape("frame", "FrameworkLibrary", "component", 310, 90, 220, 70)
    d.shape("map", "ControlMapper", "component", 310, 240, 220, 70)
    d.shape("risk", "RiskModule", "component", 600, 90, 210, 70)
    d.shape("compl", "ComplianceModule", "component", 600, 240, 210, 70)
    d.shape("policy", "PolicyModule", "component", 600, 390, 210, 70)
    d.shape("evid", "EvidenceRepository", "component", 880, 240, 230, 70)
    d.shape("assess", "AssessmentEngine", "component", 880, 90, 230, 70)
    d.shape("issue", "IssueTracker", "component", 880, 390, 230, 70)
    d.shape("report", "RegulatoryReporting", "component", 1180, 240, 230, 70)
    d.shape("i_fw", "IFrameworkLookup", "provided", 275, 105, 22, 22)
    d.shape("i_map", "IControlMapping", "provided", 275, 255, 22, 22)
    d.shape("i_risk", "IRiskQuery", "provided", 565, 105, 22, 22)
    d.shape("i_comp", "IComplianceState", "provided", 565, 255, 22, 22)
    d.shape("i_evid", "IEvidenceStore", "provided", 845, 255, 22, 22)
    d.shape("i_issue", "IIssueRaise", "provided", 845, 405, 22, 22)
    d.edge("portal", "risk", "dep", "IRiskQuery")
    d.edge("portal", "compl", "dep", "IComplianceState")
    d.edge("portal", "policy", "dep", "IPolicyLookup")
    d.edge("map", "frame", "dep", "IFrameworkLookup")
    d.edge("risk", "map", "dep", "IControlMapping")
    d.edge("compl", "map", "dep", "IControlMapping")
    d.edge("policy", "map", "dep", "IControlMapping")
    d.edge("assess", "evid", "dep", "IEvidenceStore")
    d.edge("compl", "evid", "dep", "IEvidenceStore")
    d.edge("assess", "issue", "dep", "IIssueRaise")
    d.edge("compl", "issue", "dep", "IIssueRaise")
    d.edge("report", "compl", "dep", "IComplianceState")
    d.edge("report", "risk", "dep", "IRiskQuery")
    d.legend(COMPONENT_LEGEND + ["one control, mapped to many frameworks"],
             x=40, y=330)
    return d.xml()


CFG78_Q = """\
"Pellworth Bank" - Governance, Risk and Compliance Platform

Pellworth is assessed against three overlapping standards, and currently tests \
the same control three times because each standard names it differently. Model \
an architecture that tests it once.

a) Staff reach the system only through the GRC portal. No other component has a \
user interface.
b) The framework library provides IFrameworkLookup and holds each standard's \
clauses under that standard's own references.
c) The control mapper provides IControlMapping and depends on \
IFrameworkLookup. It maps one internal control to the clauses of every framework \
that requires it.
d) The risk module provides IRiskQuery, the compliance module provides \
IComplianceState, and the policy module provides IPolicyLookup. All three depend \
on IControlMapping -- the same interface, not three copies.
e) The portal depends on IRiskQuery, IComplianceState and IPolicyLookup, and on \
nothing else.
f) The assessment engine and the compliance module both write to the evidence \
repository through IEvidenceStore.
g) The assessment engine and the compliance module both raise findings through \
the issue tracker's IIssueRaise interface.
h) Regulatory reporting depends on IComplianceState and IRiskQuery. Nothing \
depends on regulatory reporting."""

CFG78_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (c) is what solves the problem in the opening paragraph. Explain \
in one sentence how mapping one control to three frameworks turns three tests \
into one, and what piece of evidence is then reused.
5. Requirement (d) has three consumers of IControlMapping. State what you would \
have to change to add a fourth standard, and what you would have to change in \
the risk module -- then say what that answer tells you about the design."""


# ----------------------------------------------- cfg 79, ACTIVITY_DIAGRAM
def internal_audit_activity():
    d = Diagram("ISMS Internal Audit",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 160, 90, 40, 40)
    d.shape("plan", "Plan the audit\nand agree scope", "action", 90, 165, 200, 55)
    d.shape("indep", "Confirm auditor\nindependence", "action", 90, 250, 200, 55)
    d.shape("d0", "auditor\nindependent?", "decision", 110, 340, 175, 90)
    d.shape("swap", "Appoint a\ndifferent auditor", "action", 440, 355, 190, 55)
    d.shape("fork", "", "bar", 430, 465, 10, 200)
    d.shape("docs", "Review the\ndocumentation", "action", 80, 485, 200, 55)
    d.shape("interview", "Interview the\ncontrol owners", "action", 490, 485, 190, 55)
    d.shape("observe", "Observe the control\nin operation", "action", 490, 575, 200, 55)
    d.shape("join", "", "bar", 430, 690, 10, 200)
    d.shape("assess", "Assess against\nthe audit criteria", "action", 90, 710, 200, 55)
    d.shape("d1", "nonconformity\nfound?", "decision", 110, 800, 175, 95)
    d.shape("raise", "Raise a\nnonconformity", "action", 440, 815, 190, 55)
    d.shape("d2", "major or\nminor?", "decision", 700, 805, 170, 95)
    d.shape("major", "Escalate to\nmanagement", "action", 950, 820, 190, 55)
    d.shape("report", "Issue the\naudit report", "action", 90, 925, 200, 55)
    d.shape("d3", "corrective actions\naccepted?", "decision", 100, 1015, 190, 95)
    d.shape("renegotiate", "Agree revised\nactions", "action", 440, 1030, 190, 55)
    d.shape("close", "Close the audit\nand schedule follow-up", "action",
            90, 1140, 220, 55)
    d.shape("end", "", "end", 175, 1230, 40, 40)
    d.flow("start", "plan")
    d.flow("plan", "indep")
    d.flow("indep", "d0")
    d.flow("d0", "swap", "[no]")
    d.flow("swap", "indep")
    d.flow("d0", "fork", "[yes]")
    d.flow("fork", "docs")
    d.flow("fork", "interview")
    d.flow("fork", "observe")
    d.flow("docs", "join")
    d.flow("interview", "join")
    d.flow("observe", "join")
    d.flow("join", "assess")
    d.flow("assess", "d1")
    d.flow("d1", "raise", "[yes]")
    d.flow("raise", "d2")
    d.flow("d2", "major", "[major]")
    d.flow("major", "report")
    d.flow("d2", "report", "[minor]")
    d.flow("d1", "report", "[no]")
    d.flow("report", "d3")
    d.flow("d3", "renegotiate", "[no]")
    d.flow("renegotiate", "d3")
    d.flow("d3", "close", "[yes]")
    d.flow("close", "end")
    d.legend(PROCESS_LEGEND, x=950, y=1000)
    return d.xml()


CFG79_Q = """\
ISMS Internal Audit

An information security manager is documenting how an internal audit is \
conducted, so that an external assessor can see it is systematic and impartial.

a) The audit is planned and its scope agreed, then the auditor's independence \
is confirmed.
b) An auditor who is not independent of the area being audited is replaced, and \
independence is confirmed again.
c) Three evidence-gathering activities then run: reviewing the documentation, \
interviewing the control owners, and observing the control in operation. They \
are independent and may run in any order or at the same time; assessment waits \
until all three are complete.
d) The evidence is assessed against the audit criteria.
e) If a nonconformity is found it is raised, and classified as major or minor. A \
major nonconformity is additionally escalated to management; a minor one is not.
f) Whether or not a nonconformity was found, the audit report is issued.
g) The auditee's proposed corrective actions are reviewed. If they are not \
accepted, revised actions are agreed and reviewed again.
h) Once accepted, the audit is closed and a follow-up is scheduled."""

CFG79_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees before the assessment is made.
4. Label EVERY decision branch with its guard. Requirements (e) and (f) mean \
three different branches converge on the report -- show them converging on one \
activity rather than drawing it three times.
5. Requirement (b) is about impartiality, not competence. Explain in one \
sentence why independence is confirmed BEFORE any evidence is gathered, and what \
an external assessor would conclude if it were confirmed afterwards."""


# ------------------------------------------------------ cfg 80, UML_CLASS
def security_principles_model():
    d = Diagram("Pellworth Bank - Security Principles Class Model",
                "UML class diagram (model answer)")
    d.node("subject", "Subject", ["# subjectId: String", "# displayName: String",
                                  "# isActive: boolean",
                                  "+ authenticate(c: Credential): boolean",
                                  "+ describe(): String"], 400, 90, 250, abstract=True)
    d.node("human", "HumanUser", ["- employeeNumber: String",
                                  "- lastPasswordChange: Date",
                                  "+ authenticate(c: Credential): boolean",
                                  "+ requiresMfa(): boolean"], 120, 320, 240)
    d.node("svc", "ServiceAccount", ["- ownerTeam: String", "- rotationDays: int",
                                     "+ authenticate(c: Credential): boolean",
                                     "+ isOverdueRotation(): boolean"], 400, 320, 240)
    d.node("dev", "DeviceIdentity", ["- deviceSerial: String",
                                     "- attestationRef: String",
                                     "+ authenticate(c: Credential): boolean",
                                     "+ isCompliant(): boolean"], 680, 320, 240)
    d.node("cred", "Credential", ["# credentialId: String", "# issuedOn: Date",
                                  "# expiresOn: Date",
                                  "+ isExpired(): boolean",
                                  "+ strength(): int"], 960, 90, 240, abstract=True)
    d.node("pw", "PasswordCredential", ["- hash: String", "- algorithm: String",
                                        "+ strength(): int",
                                        "+ meetsPolicy(): boolean"], 960, 320, 240)
    d.node("certc", "CertificateCredential", ["- serial: String",
                                              "- issuerDn: String",
                                              "+ strength(): int",
                                              "+ isRevoked(): boolean"], 1240, 320, 250)
    d.node("asset", "Asset", ["- assetId: String", "- name: String",
                              "- classification: String",
                              "+ requiresEncryption(): boolean",
                              "+ retentionDays(): int"], 120, 90, 240)
    d.node("perm", "Permission", ["- permissionId: String", "- action: String",
                                  "- scope: String",
                                  "+ implies(p: Permission): boolean",
                                  "+ describe(): String"], 120, 560, 240)
    d.node("grant", "Grant", ["- grantId: String", "- grantedOn: Date",
                              "- expiresOn: Date",
                              "+ isCurrent(): boolean",
                              "+ revoke(): void"], 400, 560, 230)
    d.node("event", "AuditEvent", ["- eventId: long", "- occurredAt: Date",
                                   "- outcome: String",
                                   "+ isDenial(): boolean",
                                   "+ summarise(): String"], 680, 560, 240)
    d.edge("subject", "human", "gen")
    d.edge("subject", "svc", "gen")
    d.edge("subject", "dev", "gen")
    d.edge("cred", "pw", "gen")
    d.edge("cred", "certc", "gen")
    d.edge("subject", "cred", "comp", "holds", "1", "1..*")
    d.edge("subject", "grant", "comp", "is given", "1", "0..*")
    d.edge("perm", "grant", "assoc", "is conveyed by", "1", "0..*")
    d.edge("asset", "perm", "aggr", "is protected by", "1", "1..*")
    d.edge("subject", "event", "assoc", "generates", "1", "0..*")
    d.edge("asset", "event", "assoc", "is recorded in", "1", "0..*")
    d.legend(UML_LEGEND, x=960, y=560)
    return d.xml()


CFG80_Q = """\
"Pellworth Bank" - Security Principles Class Model

Pellworth's code treats a human login, a service account and a device as three \
unrelated things, so an access check is written three times. Model the classes \
so it is written once.

a) Every subject has a subject ID, a display name and an active flag, and can \
authenticate with a credential and describe itself.
b) There are three kinds of subject and nothing is ever just a subject. A human \
user adds an employee number and a last password change date; a service account \
adds an owning team and a rotation period; a device identity adds a serial and \
an attestation reference. Each provides its own authenticate().
c) Every credential has an ID, an issue date and an expiry date, and can report \
whether it is expired and how strong it is.
d) Password credentials and certificate credentials are both credentials, and a \
bare credential is never instantiated. A password credential adds a hash and an \
algorithm; a certificate credential adds a serial and an issuer DN.
e) A subject holds one or more credentials. A credential has no meaning apart \
from its subject and is destroyed with it.
f) An asset has an ID, a name and a classification, and can report whether it \
must be encrypted and how long it is retained.
g) An asset is protected by one or more permissions, each with an action and a \
scope. Permissions are defined centrally and survive the asset being archived.
h) A subject is given any number of grants. Each conveys exactly one permission \
and records when it was granted and when it expires. Grants are deleted with the \
subject.
i) A subject generates any number of audit events, each recording a timestamp \
and an outcome, and each concerning exactly one asset."""

CFG80_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Justify in one sentence each: why Subject-Credential and Subject-Grant are \
composition, but Asset-Permission is only aggregation.
5. Two classes are abstract. Name both, quote the sentence that makes each one \
abstract, and explain in one sentence how requirement (b) lets the access check \
in the opening paragraph be written once instead of three times."""


# ------------------------------------------------------------ cfg 81, ERD
def classification_handling():
    d = Diagram("Pellworth Bank - Information Classification and Handling",
                "Entity-relationship diagram (model answer)")
    d.node("cls", "Classification", ["PK classificationId: String", "label: String",
                                     "rank: int", "description: String"], 40, 90)
    d.node("rule", "HandlingRule", ["PK ruleId: String", "FK classificationId: String",
                                    "FK mediumId: String", "requirement: String",
                                    "isMandatory: boolean"], 320, 90)
    d.node("medium", "StorageMedium", ["PK mediumId: String", "name: String",
                                       "isPortable: boolean"], 620, 90)
    d.node("info", "InformationAsset", ["PK assetId: String",
                                        "FK classificationId: String",
                                        "FK ownerId: String", "name: String",
                                        "createdOn: Date"], 40, 320)
    d.node("owner", "InformationOwner", ["PK ownerId: String", "fullName: String",
                                         "department: String"], 40, 560)
    d.node("holding", "AssetHolding", ["PK holdingId: String", "FK assetId: String",
                                       "FK mediumId: String", "location: String",
                                       "isEncrypted: boolean"], 320, 320)
    d.node("retention", "RetentionSchedule", ["PK scheduleId: String",
                                              "FK classificationId: String",
                                              "retainYears: int",
                                              "disposalMethod: String"], 620, 320)
    d.node("review", "ClassificationReview", ["PK reviewId: String", "FK assetId: String",
                                              "FK reviewerId: String",
                                              "reviewedOn: Date",
                                              "newClassificationId: String"],
           320, 560)
    d.node("disposal", "DisposalRecord", ["PK disposalId: String",
                                          "FK holdingId: String", "disposedOn: Date",
                                          "certificateRef: String"], 620, 560)
    d.node("transfer", "TransferEvent", ["PK transferId: String", "FK assetId: String",
                                         "FK recipientId: String",
                                         "transferredOn: Date",
                                         "wasApproved: boolean"], 900, 320)
    d.edge("cls", "rule", "comp", "prescribes", "1", "1..*")
    d.edge("medium", "rule", "assoc", "is governed by", "1", "0..*")
    d.edge("cls", "info", "assoc", "classifies", "1", "0..*")
    d.edge("owner", "info", "assoc", "owns", "1", "0..*")
    d.edge("info", "holding", "comp", "is held as", "1", "1..*")
    d.edge("medium", "holding", "assoc", "stores", "1", "0..*")
    d.edge("cls", "retention", "comp", "sets", "1", "1..*")
    d.edge("info", "review", "comp", "is reviewed by", "1", "0..*")
    d.edge("owner", "review", "assoc", "performs", "1", "0..*")
    d.edge("holding", "disposal", "comp", "ends in", "1", "0..1")
    d.edge("info", "transfer", "comp", "undergoes", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=560)
    return d.xml()


CFG81_Q = """\
"Pellworth Bank" - Information Classification and Handling

Pellworth classifies information but cannot show that a confidential file on a \
laptop was encrypted, or that it was destroyed when its retention expired. Model \
the data.

a) A classification has a label, a rank and a description. Classifications are a \
standing list.
b) A storage medium has a name and a portable flag, and is a standing list.
c) A classification prescribes one or more handling rules. Each rule applies to \
exactly one storage medium and states a requirement and whether it is mandatory. \
A rule has no meaning apart from its classification.
d) A classification sets one or more retention schedules, each with a retention \
period in years and a disposal method.
e) An information asset has a name and a creation date, is classified by exactly \
one classification, and is owned by exactly one information owner. Owners remain \
on file after an asset is disposed of.
f) An information asset is held as one or more asset holdings. Each records the \
medium, a location and whether it is encrypted, and is deleted with the asset.
g) An asset holding ends in at most one disposal record, with a disposal date \
and a certificate reference.
h) An information asset is reviewed by any number of classification reviews, \
each performed by exactly one owner and recording the date and the new \
classification.
i) An information asset undergoes any number of transfer events, each recording \
the recipient, the date and whether it was approved."""

CFG81_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Answer the first question in the opening paragraph: name the two entities and \
the single attribute you would compare to prove a confidential file on a laptop \
was encrypted, and trace the path on your diagram.
4. Answer the second: name the entities you would join to find holdings past \
their retention period with no disposal record, and state which cardinality makes \
"no disposal record" expressible.
5. Requirement (c) makes a handling rule depend on a classification AND a \
medium. Explain in one sentence why the rule cannot hang off the classification \
alone."""


# -------------------------------------------------- cfg 82, UML_COMPONENT
def certification_toolchain():
    d = Diagram("Pellworth Bank - Certification Readiness Toolchain",
                "UML component diagram (model answer)")
    d.shape("scope", "ScopeDefinition", "component", 40, 90, 210, 70)
    d.shape("soa", "StatementOfApplicability", "component", 320, 90, 240, 70)
    d.shape("catalog", "ControlCatalogue", "component", 320, 240, 240, 70)
    d.shape("collect", "EvidenceCollector", "component", 630, 240, 220, 70)
    d.shape("store", "EvidenceRepository", "component", 630, 90, 220, 70)
    d.shape("gap", "GapAnalyser", "component", 920, 90, 210, 70)
    d.shape("plan", "RemediationPlanner", "component", 920, 240, 210, 70)
    d.shape("audit", "AuditPackBuilder", "component", 1200, 90, 220, 70)
    d.shape("mgmt", "ManagementReview", "component", 920, 390, 210, 70)
    d.shape("cert", "CertificationBody", "component", 1200, 240, 220, 70)
    d.shape("i_scope", "IScopeQuery", "provided", 285, 105, 22, 22)
    d.shape("i_soa", "IApplicability", "provided", 595, 105, 22, 22)
    d.shape("i_cat", "IControlLookup", "provided", 285, 255, 22, 22)
    d.shape("i_store", "IEvidenceStore", "provided", 595, 255, 22, 22)
    d.shape("i_gap", "IGapReport", "provided", 885, 105, 22, 22)
    d.shape("i_plan", "IRemediationPlan", "provided", 885, 255, 22, 22)
    d.edge("soa", "scope", "dep", "IScopeQuery")
    d.edge("soa", "catalog", "dep", "IControlLookup")
    d.edge("collect", "soa", "dep", "IApplicability")
    d.edge("collect", "store", "dep", "IEvidenceStore")
    d.edge("gap", "soa", "dep", "IApplicability")
    d.edge("gap", "store", "dep", "IEvidenceStore")
    d.edge("plan", "gap", "dep", "IGapReport")
    d.edge("mgmt", "gap", "dep", "IGapReport")
    d.edge("mgmt", "plan", "dep", "IRemediationPlan")
    d.edge("audit", "store", "dep", "IEvidenceStore")
    d.edge("audit", "soa", "dep", "IApplicability")
    d.edge("cert", "audit", "dep", "receives pack from")
    d.legend(COMPONENT_LEGEND + ["scope decides applicability decides evidence"],
             x=40, y=240)
    return d.xml()


CFG82_Q = """\
"Pellworth Bank" - Certification Readiness Toolchain

Pellworth failed its last certification audit because the evidence it collected \
did not match the controls it had declared applicable. Model an architecture \
where that cannot happen.

a) The scope definition component provides IScopeQuery and is the single \
statement of what is in scope.
b) The control catalogue provides IControlLookup and holds every control \
definition.
c) The statement of applicability depends on IScopeQuery and IControlLookup, and \
provides IApplicability. It is the only component that decides whether a control \
applies.
d) The evidence collector depends on IApplicability and collects only for \
controls declared applicable. It writes through the evidence repository's \
IEvidenceStore interface.
e) The gap analyser depends on both IApplicability and IEvidenceStore, and \
provides IGapReport. It reports a gap where a control is applicable but has no \
evidence.
f) The remediation planner depends on IGapReport and provides IRemediationPlan.
g) Management review depends on IGapReport and IRemediationPlan.
h) The audit pack builder depends on IEvidenceStore and IApplicability, and the \
certification body receives the pack from it.
i) Nothing depends on the certification body, and the control catalogue depends \
on nothing."""

CFG82_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (d) says the collector depends on IApplicability. Explain in one \
sentence how that single dependency prevents the failure described in the \
opening paragraph.
5. Requirement (e) defines a gap as applicable-but-no-evidence. Trace on your \
diagram the two interfaces the gap analyser must combine to detect one, and \
state what a control with evidence but NOT declared applicable would indicate."""


BATCH = [
    (71, CFG71_Q, CFG71_I, physical_layer_components),
    (72, CFG72_Q, CFG72_I, iot_standards_stack),
    (73, CFG73_Q, CFG73_I, m2m_edge_pipeline),
    (74, CFG74_Q, CFG74_I, load_balanced_service),
    (75, CFG75_Q, CFG75_I, device_provisioning),
    (76, CFG76_Q, CFG76_I, iot_platform_records),
    (77, CFG77_Q, CFG77_I, threat_modelling_records),
    (78, CFG78_Q, CFG78_I, grc_platform),
    (79, CFG79_Q, CFG79_I, internal_audit_activity),
    (80, CFG80_Q, CFG80_I, security_principles_model),
    (81, CFG81_Q, CFG81_I, classification_handling),
    (82, CFG82_Q, CFG82_I, certification_toolchain),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 8")
