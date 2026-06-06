# Changelog

All notable changes to the eAushadhi Integration Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta] - 2026-06-06

### Added

#### Admin Features
- Institute mapping administration page
- Facility-to-eAushadhi institute ID linking
- Supplier-to-warehouse mapping configuration
- Default supplier selection
- Schema version management
- Encrypted credentials reference storage
- Workflow permission controls:
  - `disable_inward_date` - Lock inward date to today
  - `manual_addition` - Allow manual item addition
  - `allow_deleting_inward_after_fetch` - Control deletion of fetched records
  - `allow_updating_quantity_after_received` - Control quantity editing after receipt

#### Core Workflow
- Delivery order creation page
- eAushadhi inward fetch page with real-time polling
- Supply delivery form with auto-prefill from eAushadhi
- Delivery order show page with item display
- Delivery order edit page
- Product mapping from eAushadhi drugs to CARE products

#### Technical Features
- Institute mapping context provider for centralized data
- Date formatting utilities (`formatDateForEaushadhiAPI`, `formatDateForURL`)
- Super batch request integration for bulk operations
- React Query integration for efficient data fetching
- Internationalization (i18n) support with English translations
- RESTful route structure for better navigation

#### UI Components
- Custom toggle switch component
- Product mapping selector with lazy loading
- Status indicators and badges
- Loading states and skeletons
- Empty state handling
- Error state handling with retry options

#### Deployment
- Hosted micro-frontend deployment at Cloudflare Workers
- Production URL: `https://eaushadhi.care-ecosystem.workers.dev/assets/remoteEntry.js`
- Plugin configuration for CARE FE:
  ```json
  {
    "url": "https://eaushadhi.care-ecosystem.workers.dev/assets/remoteEntry.js",
    "name": "care_eaushadhi_fe"
  }
  ```
- Plugin slug: `care_eaushadhi_fe`
- Superadmin configuration via CARE FE plugin management interface

### Changed
- Renamed components for consistency:
  - `EAusdhadhiFetchPage` → `EAusdhadhiDeliveryCreate`
  - `DeliveryOrderShow` → `EAusdhadhiDeliveryShow`
  - `DeliveryOrderForm` → `EAusdhadhiDeliveryEdit`
  - `DeliveryOrderFetch` → `EAusdhadhiInwardFetch`
- Updated routes to follow RESTful pattern with singular "delivery"
- Simplified delivery workflow (Draft → Approved → End)


### Dependencies
- Requires `care_eaushadhi` backend plugin
- Requires `super_batch_request` backend plugin

### Technical Details
- Built with React 19.1.0
- Uses Vite for bundling
- Tailwind CSS v4 for styling
- TypeScript for type safety
- React Query (Tanstack Query) for server state
- Raviger for routing

---

## Notes

This is the initial beta release. Features and APIs are subject to change in future versions.

For migration guides and breaking changes, please refer to the main README.md file.
