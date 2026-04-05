# Stakeholder Map

## Internal Stakeholders

| Role | Responsibilities in Platform | Key Concerns |
|------|------------------------------|--------------|
| Product Owner (MAPMDREF rep) | Prioritizes backlog, signs off releases | Regulatory compliance, Law 25-06 alignment |
| Backend Lead | Architecture, code review, ADRs | Module isolation, test coverage, security |
| Backend Dev 1 | Cooperative + Product modules | TypeORM, PostGIS, Kafka producers |
| Backend Dev 2 | Certification + Notification modules | State machine, Handlebars, trilingual support |
| DevOps Engineer | Docker, CI/CD, monitoring (Phase 2) | Deployment reliability, secret management |

## External Stakeholders (Platform Users)

| Role | Keycloak Role | Key Concerns |
|------|---------------|--------------|
| Cooperative administrators | `cooperative-admin` | Easy registration, certification status visibility |
| Cooperative members (harvesters) | `cooperative-member` | Simple harvest logging, mobile-friendly |
| Lab technicians | `lab-technician` | Test result submission, parameter templates |
| Inspectors | `inspector` | Mobile-friendly report filing, GPS location |
| Certification body staff | `certification-body` | Dashboard of pending requests, bulk actions |
| Customs agents (EACCE) | `customs-agent` | Quick export document validation |
| Consumers | `consumer` (or anonymous) | QR scan = instant verification < 200ms |

## Government Bodies

| Body | Full Name | Role in Platform | Contact Point |
|------|-----------|-----------------|---------------|
| MAPMDREF | Ministère de l'Agriculture, de la Pêche Maritime, du Développement Rural et des Eaux et Forêts | Data controller; approves certification framework | Direction SDOQ |
| ONSSA | Office National de Sécurité Sanitaire des Produits Alimentaires | Accredits labs; validates test parameters | Direction des Contrôles |
| EACCE | Etablissement Autonome de Contrôle et de Coordination des Exportations | Export document validation; customs clearance | Direction Export |
| CNDP | Commission Nationale de contrôle de la Protection des Données à caractère Personnel | Data protection authority; CNDP declaration approval | cndp.ma |
