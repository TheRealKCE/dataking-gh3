# DataGod Provider Setup and Integration

This document explains how the DataGod provider is integrated into the ARHMS platform and how to set it up for manual fulfillment.

## Overview

DataGod is an external data provider used for manual fulfillment of mobile data orders (MTN, Telecel, AT). It operates through an isolated console within the admin panel, allowing admins to manually trigger fulfillment for pending orders.

## Configuration

To enable DataGod integration, you need to set the following environment variables in your `.env` or `.env.local` file:

- `DATAGOD_API_KEY`: Your unique API key provided by DataGod.
- `DATAGOD_API_BASE_URL`: (Optional) The base URL for the DataGod API. Defaults to `https://datagod.store/api/v1`.

## Core Components

### 1. Service Layer (`lib/datagod-service.ts`)
The service layer handles all direct communication with the DataGod API. It includes functions for:
- `fetchDataGodBalance()`: Retrieves the current account balance and user info.
- `fulfillDataGodOrder()`: Sends a fulfillment request to DataGod.
- `checkDataGodOrderStatus()`: Queries the status of an existing order using a reference.

### 2. Admin Console (`app/admin/datagod/page.tsx`)
Located at `/admin/datagod` in the application, this console provides:
- **Balance Monitoring**: View your current DataGod wallet balance.
- **Pending Orders**: View and select orders that are ready for fulfillment.
- **Fulfillment**: Batch process selected orders through the DataGod API.
- **History & Sync**: Track past DataGod fulfillments and sync their live status.

### 3. API Routes (`app/api/admin/datagod/`)
- `/api/admin/datagod/orders`: Fetches pending orders from the database.
- `/api/admin/datagod/history`: Fetches orders previously fulfilled via DataGod.
- `/api/admin/datagod/balance`: Proxy route to fetch the supplier balance.
- `/api/admin/datagod/fulfill`: Processes the fulfillment logic and updates order status.
- `/api/admin/datagod/sync`: Fetches live status updates for fulfilled orders.

## Fulfillment Flow

1.  **Selection**: Admin selects one or more "Pending" orders in the DataGod Console.
2.  **Request**: When "Fulfill via DataGod" is clicked, the system sends a request to the `/api/admin/datagod/fulfill` endpoint.
3.  **API Call**: The backend calls the DataGod API with the recipient number, network, and volume.
4.  **Logging**: The API response and a unique reference (`dg_orderId_timestamp`) are logged in the `mtn_fulfillment_tracking` table.
5.  **Status Update**:
    - If successful, the order status is updated to `completed` or `processing`.
    - If it fails, the order remains `pending`, but the failure is logged in the tracking table.

## Troubleshooting

- **API Key Error**: Ensure `DATAGOD_API_KEY` is correctly set and has sufficient permissions.
- **Balance Issues**: If the balance doesn't load, verify connectivity to `datagod.store`.
- **Fulfillment Failure**: Check the "DataGod History" tab and click "Fetch Live Status" to see detailed error messages from the supplier.
