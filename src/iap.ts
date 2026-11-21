import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases"
import { isNativeApp } from "@/native.ts"

/** StoreKit consumable. Resolves only after Apple accepts the purchase. */
export async function purchasePointPack(productId: string): Promise<{ transactionId: string }> {
  if (!isNativeApp()) throw new Error("The website does not charge. This pack is an App Store purchase.")
  const tx = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.INAPP,
    isConsumable: true,
  })
  if (!tx.transactionId) throw new Error("The App Store did not finish that purchase.")
  return { transactionId: tx.transactionId }
}
