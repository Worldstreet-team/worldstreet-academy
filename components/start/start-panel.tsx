import Image from "next/image"

/**
 * The picker's last step, laid out like an order: what you are choosing on
 * the left (the heading, then what the package includes), the decision on the
 * right (the panel holding the choice and both buttons), so the price and the
 * one gold CTA sit above the fold on a laptop. Phones stack intro → panel →
 * details, keeping the decision next to the heading.
 */
export function StartColumns({
  intro,
  panel,
  details,
}: {
  intro: React.ReactNode
  panel: React.ReactNode
  details?: React.ReactNode
}) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-0">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">{intro}</div>
      <div
        className="rise min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        style={{ "--rise-delay": "90ms" } as React.CSSProperties}
      >
        {panel}
      </div>
      {details && <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:pt-12">{details}</div>}
    </div>
  )
}

/**
 * The decision panel: a 20px card with the chosen school's cover as a strip,
 * tying the last step back to the card picked on the first. The strip is
 * desktop-only — on a phone it would push the buttons below the fold. The
 * crop sits at 55% (the school banner uses 65%): at this narrower 21:9 frame
 * that is the one focal point that keeps all eight objects whole, the Trading
 * candles' tallest wick included, with the top of every plinth still showing.
 */
export function StartPanel({ cover, children }: { cover: string | null; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
      {cover && (
        <div className="relative hidden aspect-[21/9] bg-ws-sunken lg:block">
          <Image src={cover} alt="" fill sizes="432px" className="object-cover object-[center_55%]" />
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}
