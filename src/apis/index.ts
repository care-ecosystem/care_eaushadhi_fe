// import { HttpMethod } from "@/apis/types";
// import type {
//   SuperBatchRequestBody,
//   SuperBatchResponse,
//   SuperBatchResult,
//   SuperBatchSubRequest,
// } from "@/apis/types";
// import { request } from "@/apis/query";

// export const SUPER_BATCH_REQUEST_PATH = "/api/super_batch_request/";

// export const apis = {
//   /**
//    * POST a batch of chained sub-requests to the super_batch_request plugin.
//    * Atomic on the server: if any step returns >299 the server responds 400 and
//    * rolls everything back (request() then rejects with the { results } body).
//    */
//   superBatchRequest: (payload: SuperBatchRequestBody) =>
//     request<SuperBatchResponse>(
//       SUPER_BATCH_REQUEST_PATH,
//       HttpMethod.POST,
//       payload,
//     ),
// };

// // ---------------------------------------------------------------------------
// // Per-row delivery batch builder
// // ---------------------------------------------------------------------------
// // Values are supplied by the caller (mapped from a form row + page props);
// // nothing is hardcoded here. Chained fields are null and filled by the server
// // from earlier responses via `replacements`.

// /** Page-level context shared by every row in one Save. */
// function refsForRow(rowIndex: number) {
//   return {
//     product: `row${rowIndex}_product`,
//     supply: `row${rowIndex}_supply`,
//     inward: `row${rowIndex}_inward`,
//   };
// }
// export interface RowDeliveryBatchContext {
//   facilityId: string;
//   destination: string; // location id
//   deliveryOrderId: string; // supply order id
//   // eAushadhi record-item-delivery inputs (see note in the chat):
//   recordDeliveryId: string;
//   eaushadhiProductKnowledgeId: string;
// }

// /** The per-row inputs the builder needs (mapped from a RowItem). */
// export interface RowDeliveryInput {
//   productKnowledgeSlug: string;
//   productKnowledgeName: string;
//   chargeItemCategorySlug: string;
//   batchNumber: string;
//   expiryDate: string; // "YYYY-MM-DD"
//   packSize: number;
//   packQty: number;
//   quantity: string;
//   purchasePrice?: string;
//   recordItemId: string;
//   /** If the row already maps to an existing product (not a new batch). */
//   existingProductId?: string;
//   isNewBatch: boolean;
// }

// export function buildRowDeliveryBatch(
//   input: RowDeliveryInput,
//   ctx: RowDeliveryBatchContext,
// ): SuperBatchRequestBody {
//   const requests: SuperBatchSubRequest[] = [];
//   const reuseExistingProduct = !!input.existingProductId && !input.isNewBatch;

//   if (!reuseExistingProduct) {
//     rows.forEach((row, index) => {
//       const refs = refsForRow(index + 1);

//     requests.push({
//       reference_id: refs.product,
//       url: `/api/v1/facility/${ctx.facilityId}/product/`,
//       method: HttpMethod.POST,
//       body: {
//         status: "active",
//         batch: { lot_number: input.batchNumber },
//         expiration_date: input.expiryDate,
//         product_knowledge: input.productKnowledgeSlug,
//         charge_item_definition: null, // <- create_charge_item.$.slug
//         standard_pack_size: input.packSize,
//         extensions: {},
//       },
//       // replacements: [
//       //   {
//       //     source_path: { reference_id: "create_charge_item", path: "$.slug" },
//       //     value_path: {
//       //       reference_id: "create_product",
//       //       path: "$.charge_item_definition",
//       //       type: "body",
//       //     },
//       //   },
//       // ],
//     });
//   }
//   }
//   // 3) supply delivery -> $.id  (supplied_item <- product.$.id, or reuse)
//   requests.push({
//     reference_id: refs.supply,
//     url: "/api/v1/supply_delivery/",
//     method: HttpMethod.POST,
//     body: {
//       status: "in_progress",
//       supplied_item_type: "product",
//       supplied_item_condition: "normal",
//       supplied_item_quantity: input.quantity,
//       supplied_item: reuseExistingProduct ? input.existingProductId : null,
//       supplied_item_pack_quantity: input.packQty,
//       supplied_item_pack_size: input.packSize,
//       destination: ctx.destination,
//       order: ctx.deliveryOrderId,
//       extensions: {},
//     },
//     replacements: reuseExistingProduct
//       ? []
//       : [
//           {
//             source_path: { reference_id: "create_product", path: "$.id" },
//             value_path: {
//               reference_id: "create_supply_delivery",
//               path: "$.supplied_item",
//               type: "body",
//             },
//           },
//         ],
//   });

//   // 4) record-item-delivery (eAushadhi)
//   requests.push({
//     reference_id: refs.inward,
//     url: "/api/care_eaushadhi/record-item-deliveries/",
//     method: HttpMethod.POST,
//     body: {
//       record_item_id: input.recordItemId,
//       facility_id: ctx.facilityId,
//       supply_delivery_id: null, // <- create_supply_delivery.$.id
//       record_delivery_id: ctx.recordDeliveryId,
//       product_id: reuseExistingProduct ? input.existingProductId : null, // <- create_product.$.id
//       product_knowledge_id: ctx.eaushadhiProductKnowledgeId,
//       quantity_received: Number(input.quantity) || 0,
//     },
//     replacements: [
//       {
//         source_path: { reference_id: "create_supply_delivery", path: "$.id" },
//         value_path: {
//           reference_id: "create_inward_item",
//           path: "$.supply_delivery_id",
//           type: "body",
//         },
//       },
//       ...(reuseExistingProduct
//         ? []
//         : [
//             {
//               source_path: { reference_id: "create_product", path: "$.id" },
//               value_path: {
//                 reference_id: "create_inward_item",
//                 path: "$.product_id",
//                 type: "body" as const,
//               },
//             },
//           ]),
//     ],
//   });

//   return { requests };
// }

// /** Pull each step's data out of the results by reference_id (not array index). */
// export function extractDeliveryBatchResult(results: SuperBatchResult[]) {
//   const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
//     results.map((r) => [r.reference_id, r]),
//   );
//   const idOf = (ref: string) =>
//     (byRef[ref]?.data as { id?: string } | undefined)?.id;
//   return {
//     productId: idOf("create_product"),
//     supplyDeliveryId: idOf("create_supply_delivery"),
//     inwardItemId: idOf("create_inward_item"),
//     raw: results,
//   };
// }
import { HttpMethod } from "@/apis/types";
import type {
  SuperBatchRequestBody,
  SuperBatchResponse,
  SuperBatchResult,
  SuperBatchSubRequest,
} from "@/apis/types";
import { request } from "@/apis/query";

export const SUPER_BATCH_REQUEST_PATH = "/api/super_batch_request/";

export const apis = {
  /**
   * POST a batch of chained sub-requests to the super_batch_request plugin.
   * Atomic on the server: if any step returns >299 the server responds 400 and
   * rolls everything back (request() then rejects with the { results } body).
   */
  superBatchRequest: (payload: SuperBatchRequestBody) =>
    request<SuperBatchResponse>(
      SUPER_BATCH_REQUEST_PATH,
      HttpMethod.POST,
      payload,
    ),
};

// ---------------------------------------------------------------------------
// Per-row delivery batch builder
// ---------------------------------------------------------------------------
// Values are supplied by the caller (mapped from a form row + page props);
// nothing is hardcoded here. Chained fields are null and filled by the server
// from earlier responses via `replacements`.

/** Page-level context shared by every row in one Save. */
export interface RowDeliveryBatchContext {
  facilityId: string;
  destination: string; // location id
  deliveryOrderId: string; // supply order id
  // eAushadhi record-item-delivery inputs (see note in the chat):
  recordDeliveryId: string;
  eaushadhiProductKnowledgeId: string;
}

/** The per-row inputs the builder needs (mapped from a RowItem). */
export interface RowDeliveryInput {
  productKnowledgeSlug: string;
  productKnowledgeName: string;
  chargeItemCategorySlug: string;
  batchNumber: string;
  expiryDate: string; // "YYYY-MM-DD"
  packSize: number;
  packQty: number;
  quantity: string;
  purchasePrice?: string;
  recordItemId: string;
  /** If the row already maps to an existing product (not a new batch). */
  existingProductId?: string;
  isNewBatch: boolean;
}

/**
 * Build a single-row batch (3 sequential steps).
 * Called once per row. For parallel chaining, wrap this with buildChainBatch().
 */
export function buildRowDeliveryBatch(
  input: RowDeliveryInput,
  ctx: RowDeliveryBatchContext,
): SuperBatchRequestBody {
  const requests: SuperBatchSubRequest[] = [];
  const reuseExistingProduct = !!input.existingProductId && !input.isNewBatch;

  // Step 1: Create product (unless reusing existing)
  if (!reuseExistingProduct) {
    requests.push({
      reference_id: "create_product",
      url: `/api/v1/facility/${ctx.facilityId}/product/`,
      method: HttpMethod.POST,
      body: {
        status: "active",
        batch: { lot_number: input.batchNumber },
        expiration_date: input.expiryDate,
        product_knowledge: input.productKnowledgeSlug,
        charge_item_definition: null,
        standard_pack_size: input.packSize,
        extensions: {},
      },
    });
  }

  // Step 2: Create supply delivery
  requests.push({
    reference_id: "create_supply_delivery",
    url: "/api/v1/supply_delivery/",
    method: HttpMethod.POST,
    body: {
      status: "in_progress",
      supplied_item_type: "product",
      supplied_item_condition: "normal",
      supplied_item_quantity: input.quantity,
      supplied_item: reuseExistingProduct ? input.existingProductId : null,
      supplied_item_pack_quantity: input.packQty,
      supplied_item_pack_size: input.packSize,
      destination: ctx.destination,
      order: ctx.deliveryOrderId,
      extensions: {},
    },
    replacements: reuseExistingProduct
      ? []
      : [
          {
            source_path: { reference_id: "create_product", path: "$.id" },
            value_path: {
              reference_id: "create_supply_delivery",
              path: "$.supplied_item",
              type: "body",
            },
          },
        ],
  });

  // Step 3: Create inward item (eAushadhi)
  requests.push({
    reference_id: "create_inward_item",
    url: "/api/care_eaushadhi/record-item-deliveries/",
    method: HttpMethod.POST,
    body: {
      record_item_id: input.recordItemId,
      facility_id: ctx.facilityId,
      supply_delivery_id: null,
      record_delivery_id: ctx.recordDeliveryId,
      product_id: reuseExistingProduct ? input.existingProductId : null,
      product_knowledge_id: ctx.eaushadhiProductKnowledgeId,
      quantity_received: Number(input.quantity) || 0,
    },
    replacements: [
      {
        source_path: { reference_id: "create_supply_delivery", path: "$.id" },
        value_path: {
          reference_id: "create_inward_item",
          path: "$.supply_delivery_id",
          type: "body",
        },
      },
      ...(reuseExistingProduct
        ? []
        : [
            {
              source_path: { reference_id: "create_product", path: "$.id" },
              value_path: {
                reference_id: "create_inward_item",
                path: "$.product_id",
                type: "body" as const,
              },
            },
          ]),
    ],
  });

  return { requests };
}

/** Pull each step's data out of the results by reference_id (not array index). */
export function extractDeliveryBatchResult(results: SuperBatchResult[]) {
  const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
    results.map((r) => [r.reference_id, r]),
  );
  const idOf = (ref: string) =>
    (byRef[ref]?.data as { id?: string } | undefined)?.id;
  return {
    productId: idOf("create_product"),
    supplyDeliveryId: idOf("create_supply_delivery"),
    inwardItemId: idOf("create_inward_item"),
    raw: results,
  };
}