---
title: Product Requirements Document
app: curious-koala-hum
created: 2025-12-04T19:36:44.807Z
version: 1
source: Deep Mode PRD Generation
---

# PRODUCT REQUIREMENTS DOCUMENT

## EXECUTIVE SUMMARY

**Product Vision:** Turnstyle is a digital wardrobe platform that consolidates scattered styling workflows into one professional platform, enabling independent stylists to migrate their existing businesses from fragmented tools (Stylebook, Google Drive, iMessage) into a unified, client-collaborative system.

**Core Purpose:** Solve the pain of scattered tools and unprofessional presentation for independent stylists by providing a migration-first platform where client closets are owned by clients, looks can be created on any device, and bulk import capabilities make onboarding fast.

**Target Users:**
- **Primary:** Independent stylists with existing client bases (8-12 active clients) currently using multiple disconnected tools
- **Secondary:** High-net-worth clients who work with stylists regularly and need organized wardrobe access

**Key Features:**
- Bulk client import via CSV with invitation management
- Bulk photo upload for closet items (with future AI categorization)
- Client-owned closets with stylist collaboration access
- Look creation and approval workflow (mobile + desktop responsive)
- Direct messaging with rich content sharing
- Basic receipt tracking with photo upload

**Complexity Assessment:** Moderate
- **State Management:** Distributed (real-time messaging, collaborative editing, relationship state)
- **External Integrations:** 3 (OAuth providers: Google/Apple, future AI categorization)
- **Business Logic:** Moderate (relationship management, access control, look versioning)
- **Data Synchronization:** Moderate (real-time messaging, collaborative closet editing)

**MVP Success Metrics:**
- Stylists can import existing clients and complete onboarding in under 10 minutes
- Stylists can bulk upload closet photos and create first look within 15 minutes
- Look creation/editing works seamlessly on mobile and desktop
- Clients can approve/request changes on looks within the platform
- Real-time messaging functions without errors for stylist-client pairs

---

## 1. USERS & PERSONAS

**Primary Persona: Independent Stylist (Existing Business)**
- **Name:** Jessica, 32, Los Angeles
- **Context:** Manages 8-12 active clients using Stylebook + Google Drive + iMessage + Notes
- **Goals:** 
  - Consolidate all styling tools into one professional platform
  - Migrate existing client base quickly without manual re-entry
  - Create and edit looks on-the-go from mobile device
  - Present professional experience to clients
- **Needs:**
  - Fast bulk import for clients and closet photos
  - Mobile-responsive look creation
  - Client collaboration and approval workflow
  - Organized receipt tracking

**Secondary Persona: High-Net-Worth Client**
- **Name:** Sarah, 42, New York
- **Context:** Works with stylist 2-3 times per month, receives scattered text messages with look photos
- **Goals:**
  - Access organized view of entire wardrobe
  - Easily find past looks and styling recommendations
  - Collaborate professionally with stylist
  - Retain wardrobe data if stylist relationship changes
- **Needs:**
  - Client-owned closet that persists across stylist relationships
  - Easy look approval/feedback workflow
  - Direct messaging with stylist
  - Mobile access to wardrobe and looks

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 User-Requested Features (All are Priority 0)

**FR-001: OAuth Authentication for Stylists**
- **Description:** Stylists can sign up and log in using Google or Apple OAuth, with email/password fallback option
- **Entity Type:** System/Configuration
- **User Benefit:** Immediate access without manual account creation, leveraging trusted authentication providers
- **Primary User:** Independent Stylist
- **Lifecycle Operations:**
  - **Create:** Register new stylist account via OAuth or email/password
  - **View:** View profile information (name, photo, bio, location)
  - **Edit:** Update profile details and preferences
  - **Delete:** Account deletion option with data export
  - **Additional:** Password reset for email/password accounts, OAuth provider linking
- **Acceptance Criteria:**
  - [ ] Given a new stylist, when they click "Sign up with Google/Apple", then OAuth flow completes and account is created
  - [ ] Given OAuth signup, when account is created, then profile setup form appears for name, photo, bio, location
  - [ ] Given email/password option, when stylist registers, then account is created with secure password hash
  - [ ] Given existing account, when stylist logs in with OAuth, then session is established
  - [ ] Stylist can complete signup and profile setup in under 2 minutes
  - [ ] Stylists can update their profile information at any time
  - [ ] Stylists can delete their account with confirmation and data export option

**FR-002: Bulk Client Import via CSV**
- **Description:** Stylists  can upload a CSV , preview imported clients, and send invitations to all or selected clients
- **Entity Type:** User-Generated Content
- **User Benefit:** Eliminates manual re-entry of existing client base, enabling fast migration from previous tools
- **Primary User:** Independent Stylist
- **Lifecycle Operations:**
  - **Create:** Upload CSV file to import multiple clients at once
  - **View:** Preview imported client list before confirming, view invitation status for each client
  - **Edit:** Modify client details after import (individual client editing)
  - **Delete:** Remove imported clients before confirmation, delete individual clients after import
  - **List/Search:** View all imported clients, filter by invitation status
 
- **Acceptance Criteria:**
 
  - [ ] Given populated CSV, when stylist uploads file, then system parses and displays preview of clients to be imported
  - [ ] Given preview, when stylist reviews data, then they can see name, email, phone, and size fields for each client
  - [ ] Given preview, when stylist confirms import, then client records are created in database
  - [ ] Given imported clients, when stylist selects clients and clicks "Send Invitations", then invitation emails/SMS are sent
  - [ ] Stylist can track invitation status (sent, accepted, pending) for each client
  - [ ] Stylist can edit individual client details after import
  - [ ] Stylist can delete clients from their list
  - [ ] CSV format includes: name, email, phone, size_top, size_bottom, size_dress, size_shoes

**FR-003: Client Invitation and Magic Link Authentication**
- **Description:** Stylists can invite clients via SMS/email with personal message; clients click link to auto-create account using magic link authentication or OAuth
- **Entity Type:** Communication
- **User Benefit:** Frictionless client onboarding without requiring clients to manually create accounts
- **Primary User:** Independent Stylist (sends), High-Net-Worth Client (receives)
- **Lifecycle Operations:**
  - **Create:** Send invitation with personal message via SMS or email
  - **View:** View invitation status and history for each client
  - **Edit:** Resend invitation with updated message
  - **Delete:** Cancel pending invitation (not allowed after client accepts)
  - **Additional:** Track invitation delivery, acceptance, and relationship establishment
- **Acceptance Criteria:**
  - [ ] Given stylist has client email/phone, when they send invitation, then client receives SMS or email with magic link
  - [ ] Given invitation includes personal message field, when stylist adds message, then it appears in invitation
  - [ ] Given client clicks magic link, when they access link, then account is auto-created and they are logged in
  - [ ] Given client prefers OAuth, when they choose Google/Apple login, then account is created via OAuth
  - [ ] Given client accepts invitation, when account is created, then stylist-client relationship is automatically established
  - [ ] Given relationship is established, when client joins, then stylist receives notification
  - [ ] Stylist can view invitation status (sent, pending, accepted) for each client
  - [ ] Stylist can resend invitations if needed

**FR-004: Client-Owned Closets with Collaborative Access**
- **Description:** Closets are created under client's account ownership; stylists have edit access while relationship is active; both stylist and client can add/edit/delete items; closet persists if relationship ends; audit trail tracks all modifications
- **Entity Type:** User-Generated Content
- **User Benefit:** Clients retain ownership of their wardrobe data across stylist relationships; stylists can collaborate on closet management
- **Primary User:** High-Net-Worth Client (owner), Independent Stylist (collaborator)
- **Lifecycle Operations:**
  - **Create:** Closet is automatically created when client account is established
  - **View:** Both client and stylist can view all closet items
  - **Edit:** Both client and stylist can modify closet items while relationship is active
  - **Delete:** Client retains closet if relationship ends; stylist loses access
  - **Additional:** Audit trail for all item modifications, access control based on relationship status
- **Acceptance Criteria:**
  - [ ] Given new client account, when account is created, then closet is automatically created under client ownership
  - [ ] Given active stylist-client relationship, when stylist accesses client, then they can view and edit closet
  - [ ] Given active relationship, when either party adds/edits/deletes items, then changes are reflected for both
  - [ ] Given item modification, when change is saved, then audit trail records who made the change and when
  - [ ] Given relationship ends, when status changes to "ended", then client retains full closet access
  - [ ] Given relationship ends, when status changes to "ended", then stylist loses edit access to closet
  - [ ] Given new stylist relationship, when new relationship is established, then new stylist gains access to existing closet
  - [ ] Audit trail shows created_by and updated_by for each item

**FR-005: Bulk Photo Upload for Closet Items**
- **Description:** Stylists can select a client, drag & drop or select up to 200 images, apply common fields (brand, season) to multiple items, and save all items to client's closet; each item has basic CRUD operations
- **Entity Type:** User-Generated Content
- **User Benefit:** Fast migration of existing closet photos without manual one-by-one entry
- **Primary User:** Independent Stylist
- **Lifecycle Operations:**
  - **Create:** Upload multiple photos at once, apply metadata to batch
  - **View:** Preview uploaded items before saving, view all closet items in grid/list
  - **Edit:** Modify item details individually or in bulk after upload
  - **Delete:** Remove items individually or in bulk
  - **List/Search:** Browse closet items, search by name/brand/color, filter by category
- **Acceptance Criteria:**
  - [ ] Given stylist selects client, when they access bulk upload, then they can choose client from list
  - [ ] Given upload interface, when stylist drags folder or selects up to 200 images, then all images are queued for upload
  - [ ] Given queued images, when stylist applies common fields (brand, season), then fields are applied to all selected items
  - [ ] Given bulk edit interface, when stylist reviews items, then they can edit individual item details
  - [ ] Given items are ready, when stylist clicks "Save All", then all items are created in client's closet
  - [ ] Each uploaded item has unique ID for tracking
  - [ ] Stylist can edit individual items after bulk upload
  - [ ] Stylist can delete items individually or in bulk
  - [ ] System generates thumbnails and preview images for each photo

**FR-006: Single Photo Upload with Manual Categorization (AI Future)**
- **Description:** Stylists or clients can take photo or upload from gallery, manually enter category/colors/item type/brand/size/notes/purchase info, assign unique ID, and save to closet; works on mobile and desktop
- **Entity Type:** User-Generated Content
- **User Benefit:** Quick item addition on any device for ongoing closet management
- **Primary User:** Independent Stylist, High-Net-Worth Client
- **Lifecycle Operations:**
  - **Create:** Take photo or upload image, enter item details, save to closet
  - **View:** View item details including photo, metadata, and purchase info
  - **Edit:** Modify any item field including photo replacement
  - **Delete:** Remove item from closet
  - **Additional:** Archive item (mark as no longer in closet but retain history)
- **Acceptance Criteria:**
  - [ ] Given user wants to add item, when they click "Add Item", then they can take photo or upload from gallery
  - [ ] Given photo is selected, when user enters details, then form includes: category, colors, item type, brand, size, notes, purchase info
  - [ ] Given details are entered, when user saves, then item is created with unique ID in closet
  - [ ] Given mobile device, when user adds item, then interface is optimized for mobile input
  - [ ] Given desktop, when user adds item, then interface provides full-screen experience
  - [ ] User can view full item details by tapping/clicking item
  - [ ] User can edit any item field after creation
  - [ ] User can delete item with confirmation
  - [ ] User can archive item to mark as no longer in closet

**FR-007: Closet Browse, Search, and Filter**
- **Description:** Stylists and clients can view items by category in grid or list view, search by name/brand/color, filter by category, and sort by recently added/name/last worn
- **Entity Type:** User-Generated Content (viewing/searching)
- **User Benefit:** Easy discovery of items in large closets
- **Primary User:** Independent Stylist, High-Net-Worth Client
- **Lifecycle Operations:**
  - **View:** Browse all closet items with multiple view options
  - **List/Search:** Search across item fields, apply filters, sort results
- **Acceptance Criteria:**
  - [ ] Given user accesses closet, when they view items, then they can toggle between grid and list view
  - [ ] Given user wants to find item, when they enter search term, then results show items matching name, brand, or color
  - [ ] Given user wants to narrow results, when they apply category filter, then only items in that category are shown
  - [ ] Given user wants to organize view, when they select sort option, then items are sorted by: recently added, name, or last worn
  - [ ] Given user taps/clicks item, when item is selected, then full details are displayed
  - [ ] Search works across name, brand, and color fields
  - [ ] Filter options include all item categories
  - [ ] Sort options persist during session

**FR-008: Look Creation (Mobile + Desktop Responsive)**
- **Description:** Stylists can create looks on any device by selecting client, adding look details (name, occasion, date, notes), browsing/searching closet items, selecting items to add to look, and sending to client for approval; each item in look has unique ID for tracking; mobile and desktop optimized interfaces
- **Entity Type:** User-Generated Content
- **User Benefit:** Flexible look creation from any device, enabling quick responses to client needs
- **Primary User:** Independent Stylist
- **Lifecycle Operations:**
  - **Create:** Build new look by selecting items from closet and adding details
  - **View:** View complete look with all items and styling notes
  - **Edit:** Modify look details, add/remove items, update notes
  - **Delete:** Remove look (with confirmation)
  - **List/Search:** Browse all looks for a client, search by occasion/date
  - **Additional:** Save as draft, send for approval, track approval status, version control for iterations
- **Acceptance Criteria:**
  - [ ] Given stylist wants to create look, when they tap "Create Look", then they can select client from list
  - [ ] Given client is selected, when stylist enters look details, then form includes: name, occasion, event date, styling notes
  - [ ] Given look details are entered, when stylist taps "Add from Closet", then they can browse/search client's closet items
  - [ ] Given closet is displayed, when stylist taps items, then items are added to look
  - [ ] Given items are added, when look is saved, then each item has unique ID for tracking usage
  - [ ] Given mobile device, when stylist creates look, then interface is optimized for touch and small screen
  - [ ] Given desktop, when stylist creates look, then side-by-side view shows closet and look builder
  - [ ] Given desktop, when stylist drags items, then drag & drop adds items to look (optional enhancement)
  - [ ] Stylist can save look as draft without sending to client
  - [ ] Stylist can send look to client for approval
  - [ ] Stylist can edit look after creation
  - [ ] Stylist can delete look with confirmation
  - [ ] System tracks how many times each item is used across looks

**FR-009: Client Look Approval and Feedback**
- **Description:** Clients can view complete look with all items and styling notes, approve/reject/request changes, and add comments/feedback; stylist receives notification of client response
- **