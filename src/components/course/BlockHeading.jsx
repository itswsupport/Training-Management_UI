/**
 * The heading over each block inside the course card — an icon in a tinted
 * square with the label beside it.
 *
 * Shared by the description, objectives and topics blocks so the card reads as
 * one thing rather than three variations on a blue label.
 */
export default function BlockHeading({ icon, children }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.08em] text-gray-800 uppercase">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#3482AE]/10 text-[#3482AE]">
        {icon}
      </span>
      {children}
    </h3>
  );
}
