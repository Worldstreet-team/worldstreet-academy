import { Skel } from "@/components/ui/system"

/**
 * Checkout in its own shape while the server reads the program and the
 * wallet: heading and order on the left, the payment card on the right (a
 * phone stacks them). Static blocks — no shimmer loop.
 */
export default function CheckoutLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading checkout" className="pb-20">
      <div className="h-[49px] border-b border-ws-hairline bg-ws-sunken lg:hidden" />
      <div className="mx-auto grid w-full max-w-[1120px] gap-6 px-4 pt-6 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-x-12 lg:px-8 lg:pt-12 xl:gap-x-16">
        <div className="min-w-0 space-y-6">
          <div>
            <Skel className="h-4 w-40" />
            <Skel className="mt-4 h-9 w-72 max-w-full" />
            <Skel className="mt-3 h-4 w-80 max-w-full" />
          </div>
          <div className="hidden rounded-[20px] bg-ws-surface p-6 lg:block">
            <div className="flex items-center gap-5">
              <Skel className="aspect-[16/10] w-40 rounded-[14px]" />
              <div className="flex-1 space-y-2.5">
                <Skel className="h-3 w-32" />
                <Skel className="h-6 w-56" />
                <Skel className="h-3.5 w-40" />
              </div>
            </div>
            <Skel className="mt-6 h-16 w-full rounded-[12px]" />
          </div>
          <div className="hidden space-y-4 rounded-[20px] bg-ws-surface p-6 lg:block">
            <Skel className="h-9 w-full rounded-[10px]" />
            <Skel className="h-9 w-full rounded-[10px]" />
            <Skel className="h-9 w-full rounded-[10px]" />
          </div>
        </div>
        <div className="rounded-[20px] bg-ws-surface p-6">
          <Skel className="h-4 w-20" />
          <Skel className="mt-4 h-16 w-full rounded-[14px]" />
          <Skel className="mt-6 h-4 w-full" />
          <Skel className="mt-6 h-10 w-full" />
          <Skel className="mt-6 h-[52px] w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}
