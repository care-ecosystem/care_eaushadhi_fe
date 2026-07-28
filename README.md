# eAushadhi Integration Plugin for CARE

[![Version](https://img.shields.io/badge/version-1.0.0--BETA-blue.svg)](https://github.com/care-ecosystem/care_eaushadhi_fe)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![eGov Foundation](https://img.shields.io/badge/eGov-Foundation-orange.svg)](https://egov.org.in)


A frontend plugin for integrating eAushadhi (India's national e-pharmacy platform) with the CARE platform. This plugin enables seamless synchronization of pharmacy inward stock details from eAushadhi into CARE's inventory management system.

## Quick Links

- 🚀 **Hosted Plugin URL**: `https://eaushadhi.care-ecosystem.workers.dev/assets/remoteEntry.js`
- 📐 **Tech & Product Design**: [Design Documentation](https://care-ecosystem.github.io/Designs/features/eaushadhi-v2/index.html)
- 📦 **Backend Plugin**: [care_eaushadhi](https://github.com/care-ecosystem/care_eaushadhi)
- 🔗 **Super Batch Plugin**: [super_batch_request](https://github.com/care-ecosystem/super_batch_request)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/care-ecosystem/care_eaushadhi_fe/issues)
- 📖 **CARE Platform**: [care.ohc.network](https://care.ohc.network)
- 🏢 **eGov Foundation**: [egov.org.in](https://egov.org.in)
- 📧 **Contact**: [jagan.kumar@egovernments.org](mailto:jagan.kumar@egovernments.org)

## Table of Contents

- [Quick Links](#quick-links)
- [Overview](#overview)
  - [Architecture](#architecture)
- [Version](#version)
- [Dependencies](#dependencies)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup Instructions](#setup-instructions)
- [Features](#features)
  - [Core Functionality](#core-functionality)
  - [Admin Features](#admin-features)
- [Screenshots](#screenshots)
- [Components](#components)
  - [Pluggable Components](#pluggable-components)
  - [Custom Pages](#custom-pages)
  - [Embedded Components](#embedded-components)
- [Pages & Functionality](#pages--functionality)
- [Technical Architecture](#technical-architecture)
  - [Context Providers](#context-providers)
  - [Utilities](#utilities)
  - [API Integration](#api-integration)
  - [State Management](#state-management)
- [Development](#development)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Workflow Overview](#workflow-overview)
- [Permissions & Roles](#permissions--roles)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

The eAushadhi Integration Plugin is one of the official CARE frontend plugins that extends CARE's functionality to work with India's eAushadhi system. It provides a complete workflow for fetching, mapping, and managing pharmaceutical stock inward records from eAushadhi warehouses.

**Developed by**: [eGov Foundation](https://egov.org.in)

This plugin was developed as part of the eGov Foundation's initiative to enhance healthcare digitization in India. The current version (v1.0.0-BETA) is specifically configured for Karnataka state deployments, with plans to generalize the solution for nationwide adoption across all state eAushadhi implementations.

For detailed technical and product design documentation, visit the [Design Documentation](https://care-ecosystem.github.io/Designs/features/eaushadhi-v2/index.html).

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CARE Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         care_eaushadhi_fe (Micro-Frontend)             │   │
│  │                                                         │   │
│  │  • Institute Mapping UI                                │   │
│  │  • Delivery Order Management                           │   │
│  │  • Inward Fetch Interface                              │   │
│  │  • Product Mapping Components                          │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                         │
│                       │ API Calls                               │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Backend Plugins                            │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  ┌──────────────────────┐  ┌─────────────────────────┐ │   │
│  │  │  care_eaushadhi      │  │ super_batch_request     │ │   │
│  │  │                      │  │                         │ │   │
│  │  │  • API Integration   │  │ • Batch Operations      │ │   │
│  │  │  • Data Transform    │  │ • Chain Requests        │ │   │
│  │  │  • Polling Logic     │  │ • Error Handling        │ │   │
│  │  └──────────┬───────────┘  └─────────────────────────┘ │   │
│  │             │                                           │   │
│  └─────────────┼───────────────────────────────────────────┘   │
│                │                                               │
└────────────────┼───────────────────────────────────────────────┘
                 │
                 │ HTTPS
                 ▼
       ┌─────────────────────┐
       │  eAushadhi Platform │
       │  (NHA, India)       │
       └─────────────────────┘
```

## Version

**v1.0.0-BETA** - Beta Release (Karnataka-Specific)

This is a beta release and may undergo breaking changes in future versions.

> **Note**: This version is specifically tailored for Karnataka state deployments. Future releases will include a generalized version compatible with eAushadhi deployments across all states in India.

## Dependencies

This plugin requires the following backend plugins to function properly:

- **`care_eaushadhi`** - Backend plugin for eAushadhi API integration
- **`super_batch_request`** - Backend plugin for handling batch API requests

> **Important**: Ensure both backend plugins are installed and configured before using this frontend plugin.

## Getting Started

### Prerequisites

- Node.js and npm (refer to CARE FE repository for exact version required)
- CARE platform installation
- Backend plugins installed:
  - `care_eaushadhi` - Backend plugin for eAushadhi API integration
  - `super_batch_request` - Backend plugin for handling batch API requests

### Setup Instructions

#### Option 1: Using Hosted Plugin (Recommended)

1. **Configure CARE FE**:
   Add the remote plugin URL to your CARE instance configuration:
   ```bash
   REACT_ENABLED_APPS="care-ecosystem/care_eaushadhi_fe@https://eaushadhi.care-ecosystem.workers.dev/assets/remoteEntry.js"
   ```

2. **Configure Backend**:
   Ensure the required backend plugins are installed and configured:
   ```bash
   pip install care_eaushadhi super_batch_request
   ```

3. **Setup Admin Configuration**:
   - Login to CARE as admin
   - Navigate to `/admin/eaushadhi/institute-mappings`
   - Configure your facility's eAushadhi integration settings

#### Option 2: Self-Hosted Development Setup

1. **Clone both repositories**:
   ```bash
   git clone https://github.com/ohcnetwork/care_fe.git
   git clone https://github.com/care-ecosystem/care_eaushadhi_fe.git
   ```

2. **Install dependencies for CARE eAushadhi FE**:
   ```bash
   cd care_eaushadhi_fe
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Configure CARE FE**:
   ```bash
   cd ../care_fe
   ```
   Update the `REACT_ENABLED_APPS` environment variable:
   ```bash
   REACT_ENABLED_APPS="care-ecosystem/care_eaushadhi_fe@localhost:5177"
   ```
   Note: `localhost:5177` should point to where care_eaushadhi_fe is being served

5. **Setup and run CARE FE**:
   ```bash
   npm run setup
   npm install
   npm run dev
   ```

## Features

### Core Functionality

- **Automated Stock Synchronization**: Fetch inward stock records from eAushadhi in real-time
- **Product Mapping**: Map eAushadhi drugs to CARE's product knowledge base
- **Batch Operations**: Handle multiple stock entries efficiently using super batch requests
- **Multi-Facility Support**: Configure different eAushadhi institute mappings per facility
- **Configurable Workflow**: Admin-controlled settings for flexible workflow management
- **Internationalization**: Full i18n support with English translations

### Admin Features

- Institute mapping configuration
- Supplier-to-warehouse mapping
- Workflow behavior controls (delete, update quantity permissions)
- Schema version management
- Secure credentials management

## Screenshots

> **Note**: Screenshots will be added in future releases.

### Institute Mapping Configuration
*(Screenshot placeholder)*

### Delivery Order Creation
*(Screenshot placeholder)*

### Inward Fetch Status
*(Screenshot placeholder)*

### Product Mapping
*(Screenshot placeholder)*

## Components

### Pluggable Components

#### DeliveryOrderActions (eAushadhi Trigger Button)

- **Location**: Delivery order listing page, action buttons section
- **Function**: Provides "Fetch from eAushadhi" button to initiate new delivery orders
- **Features**:
  - Navigates to delivery creation page
  - Displays eAushadhi icon
  - Internationalized button text
- **Requirements**: Institute mapping must be configured for the facility

### Custom Pages

#### 1. Institute Mapping Admin
- **Route**: `/admin/eaushadhi/institute-mappings`
- **Purpose**: Configure facility-specific eAushadhi integration settings
- **Access**: Super Admin, Facility Admin only

#### 2. eAushadhi Delivery Create
- **Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/create`
- **Purpose**: Initiate a new delivery order from eAushadhi
- **Requirements**: Institute mapping configured
- **Condition**: User has facility-level access

#### 3. eAushadhi Inward Fetch
- **Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/fetch-inward`
- **Purpose**: Real-time fetching and status monitoring
- **Requirements**: Delivery order must be created

#### 4. eAushadhi Delivery Show
- **Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId`
- **Purpose**: View and manage delivery order details
- **Requirements**: Valid delivery order ID

#### 5. eAushadhi Delivery Edit
- **Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/edit`
- **Purpose**: Edit delivery order metadata
- **Condition**: Delivery order must be in draft status

### Embedded Components

#### Add Supply Delivery Form

- **Location**: Embedded within delivery order show page
- **Function**: Add and manage inward stock items from eAushadhi
- **Features**:
  - Auto-prefill from eAushadhi inward records
  - Product mapping selector
  - Quantity management
  - Bulk save operations
- **Condition**: Visible only when delivery order is in draft status
- **Requirements**:
  - Inward records must be fetched
  - Facility must have product knowledge base configured
- **Permissions-Based Behavior**:
  - Delete button controlled by `allow_deleting_inward_after_fetch` flag
  - Accepted quantity editing controlled by `allow_updating_quantity_after_received` flag

## Pages & Functionality

### 1. Institute Mapping Admin
**Route**: `/admin/eaushadhi/institute-mappings`

**Purpose**: Configure facility-specific eAushadhi integration settings

**Features**:
- Link CARE facilities to eAushadhi institute IDs
- Map CARE suppliers to eAushadhi warehouse names
- Configure default supplier for auto-selection
- Set schema version for API compatibility
- Store encrypted API credentials reference
- Control workflow permissions:
  - `disable_inward_date` - Lock inward date to today
  - `manual_addition` - Allow manual item addition
  - `allow_deleting_inward_after_fetch` - Enable deletion of fetched records
  - `allow_updating_quantity_after_received` - Allow quantity modifications post-receipt
  - `allow_creating_product_knowledge` - Allow creating new product knowledge

**User Roles**: Super Admin, Facility Admin

---

### 2. eAushadhi Delivery Create
**Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/create`

**Purpose**: Initiate a new delivery order from eAushadhi

**Features**:
- Create delivery order with custom name
- Select supplier/distributor from mapped list
- Auto-select default supplier based on configuration
- Set inward date (respects facility policy for backdating)
- Add optional notes
- Trigger initial inward fetch from eAushadhi API
- Automatic redirection to fetch-inward page

**Workflow**: Draft creation → Redirect to inward fetch

---

### 3. eAushadhi Inward Fetch
**Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/fetch-inward`

**Purpose**: Real-time fetching and status monitoring of inward records from eAushadhi

**Features**:
- **Polling Mechanism**: Auto-refresh status every 3 seconds
- **Status States**:
  - Loading: Fetching records from eAushadhi
  - Success: Records fetched successfully
  - Failed: Sync failed with retry option
  - No Records: No items found for the date
  - Redirect: Auto-redirect when items are available
- **Actions**:
  - Retry sync on failure
  - Refetch with force refresh
  - Add items manually (if enabled by admin)
- **Smart Redirection**: Auto-navigates to native CARE page after successful fetch

**Technical Details**:
- Uses React Query for efficient polling
- Implements exponential backoff on errors
- Supports both eAushadhi-native and CARE-native flows

---

### 4. Add Supply Delivery Form
**Embedded Component** - Appears within delivery order pages

**Purpose**: Add and manage inward stock items from eAushadhi

**Features**:
- **Auto-Prefill**: Populate items from eAushadhi inward records
- **Product Mapping**:
  - Search and map eAushadhi drugs to CARE products
  - Lazy-load product options on search
  - Display eAushadhi drug name alongside mapped product
- **Batch Management**:
  - Batch number (auto-filled, read-only)
  - Expiry date (auto-filled, read-only)
  - Pack size (auto-filled, read-only)
- **Quantity Management**:
  - Original pack quantity (read-only)
  - Accepted pack quantity (editable if admin allows)
  - Auto-calculated quantity in units
  - Original quantity reference display
- **Row Operations**:
  - Add new items
  - Delete items (if admin allows)
  - Bulk save with chain batching
- **Smart Validation**:
  - Product selection required
  - Batch and expiry validation
  - At least one item required
- **Permissions-Based UI**:
  - Manual addition of items controlled by `manual_addition`
  - Delete button visibility controlled by `allow_deleting_inward_after_fetch`
  - Accepted quantity editing controlled by `allow_updating_quantity_after_received`
  - Creation of new product knowledge controlled by `allow_creating_product_knowledge`
- **Empty State Handling**:
  - All items added notification
  - No items from eAushadhi state
  - Sync retry options

**Technical Implementation**:
- Uses super batch chain for efficient bulk operations
- Chunks rows into manageable batch sizes
- Implements optimistic UI updates
- Handles partial success scenarios

---

### 5. eAushadhi Delivery Show
**Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId`

**Purpose**: View and manage delivery order details

**Features**:
- **Order Information**:
  - Delivery name and status
  - Supplier/distributor details
  - Destination location
  - Created by and creation date
  - Notes and tags
- **Status Management**:
  - Draft → Approved workflow
  - Mark as Approved button (draft status only)
  - Auto-redirect to native CARE page on approval
- **Item Display**:
  - Product name with batch details
  - Expiry date
  - Quantity with units
  - Item condition
  - Status indicators
- **Actions**:
  - Print delivery order
  - Edit delivery details (draft only)
- **Embedded Forms**:
  - Add Supply Delivery Form (draft status)
- **Simplified Workflow**:
  - Removed "Mark as Completed" (workflow ends at approved)
  - No abandoned/entered-in-error states
  - No receive/update stock actions

**Workflow**: Draft → Approved → [End of eAushadhi flow]

---

### 6. eAushadhi Delivery Edit
**Route**: `/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/edit`

**Purpose**: Edit delivery order metadata

**Features**:
- Update delivery name
- Change supplier/distributor
- Modify notes
- Form validation
- Auto-populated with existing data
- Only available for draft orders

**Restrictions**: Edit disabled once order is approved

---

## Technical Architecture

### Context Providers

#### InstituteMappingContext
- Centralized institute mapping data
- Prevents redundant API calls
- Provides:
  - Institute mapping configuration
  - Supplier mappings
  - Default supplier
  - Meta flags for workflow control
- Used across all facility-scoped pages

### Utilities

#### Date Formatting
- `formatDateForEaushadhiAPI()` - Converts ISO dates to DD/MM/YYYY for eAushadhi API
- `formatDateForURL()` - Converts ISO dates to MM/DD/YYYY for URL parameters
- Consistent date handling across all components

### API Integration

- RESTful API calls using Tanstack Query (React Query)
- Batch request handling via super_batch_request plugin
- Chain batching for bulk operations
- Optimistic updates with error rollback

### State Management

- React Query for server state
- Local state with React hooks
- Context API for shared facility data
- URL-based state for navigation


## Development

### Development Server

```bash
npm run dev
```

This starts:
- Vite preview server on port 5177
- Watch mode for automatic rebuilds

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Deployment

### Hosted Micro-Frontend

The plugin is automatically deployed and hosted at:

**Production URL**: `https://eaushadhi.care-ecosystem.workers.dev/assets/remoteEntry.js`

This URL provides the compiled micro-frontend that can be loaded directly into any CARE instance without requiring local builds or deployments.

#### Plugin Configuration for CARE FE

Super admins can add this plugin to their CARE instance using the following plugin configuration:

```json
{
  "url": "https://care-eaushadhi-fe.pages.dev/assets/remoteEntry.js",
  "name": "care_eaushadhi_fe",
  // optional configurations:
  //  "config": {
  //   "schema_version": true,
  //   "credentials_ref": true,
  //   "manual_addition": true,
  //   "disable_inward_date": true,
  //   "allow_deleting_inward_after_fetch": true,
  //   "allow_updating_quantity_after_received": true

}
```

**Plugin Details:**
- **Slug Name**: `care_eaushadhi_fe`
- **Configuration Method**: Add via CARE FE super admin plugin management interface
- **Requirements**:
  - Backend plugins (`care_eaushadhi`, `super_batch_request`) must be installed
  - Super admin access required

### Self-Hosted Deployment

If you're self-hosting:

1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Deploy the `dist/` directory to your hosting service

3. Ensure the `remoteEntry.js` file is accessible at your deployment URL

4. Update your CARE instance configuration with your custom remote entry URL

## Configuration

### Environment Variables

Configure the following in your CARE instance:

- `EAUSHADHI_API_BASE_URL` - eAushadhi API endpoint
- Other CARE-specific configurations

### Admin Setup

1. Navigate to `/admin/eaushadhi/institute-mappings`
2. Click "Add Institute Mapping"
3. Configure:
   - Select CARE facility
   - Enter eAushadhi Institute ID
   - Set schema version (default: 1.0)
   - Add credentials reference (encrypted secret name)
   - Map suppliers to eAushadhi warehouses
   - Set default supplier
   - Configure workflow permissions
4. Save mapping

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Admin configures institute mapping                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 2. User creates delivery order (Draft)                         │
│    - Select supplier                                            │
│    - Set inward date                                            │
│    - Add notes                                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 3. System fetches inward records from eAushadhi                │
│    - Polling status                                             │
│    - Retry on failure                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 4. User maps eAushadhi drugs to CARE products                  │
│    - Auto-prefill from inward records                           │
│    - Manual product mapping                                     │
│    - Adjust accepted quantities                                 │
│    - Bulk save                                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 5. User marks delivery as Approved                             │
│    - Validates items exist                                      │
│    - Transitions to pending status                              │
│    - Redirects to CARE native flow                              │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ▼
            [CARE Native Workflow]
```

## Permissions & Roles

### Admin Access Required
- Institute Mapping configuration
- Workflow settings management

### Facility-Level Access
- Creating delivery orders
- Fetching inward records
- Mapping products
- Approving deliveries

## Troubleshooting

### Common Issues

1. **Inward Fetch Fails**
   - Verify eAushadhi credentials are correct
   - Check institute ID mapping
   - Ensure date format is correct
   - Review backend logs for API errors

2. **Product Mapping Not Working**
   - Ensure CARE product knowledge base is populated
   - Check facility has access to products
   - Verify eAushadhi drug IDs are valid

3. **Delete Button Not Showing**
   - Check `allow_deleting_inward_after_fetch` meta flag
   - Verify admin configuration

4. **Cannot Update Accepted Quantity**
   - Check `allow_updating_quantity_after_received` meta flag
   - Ensure item hasn't been marked as received in CARE

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
- GitHub Issues: [https://github.com/care-ecosystem/care_eaushadhi_fe/issues](https://github.com/care-ecosystem/care_eaushadhi_fe/issues)
- CARE Community: [care.ohc.network](https://care.ohc.network)

## License

ISC License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- [eGov Foundation](https://egov.org.in) - Development and implementation
- CARE Platform Team
- eAushadhi Team (National Health Authority, India)
- Open Healthcare Network
- Karnataka State Health Department

---

**Note**: This is a beta release (v1.0.0-BETA). Features and APIs may change in future versions. Always refer to the latest documentation for production deployments.
