import { useEffect, useRef, useMemo } from "react";
import { formatText } from "../utils/formatText";

/**
 * Renders formatted text with Discord-like markdown support.
 * Handles spoiler clicks for reveal.
 */
export default function FormattedText({ text, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    // Handle spoiler clicks
    const handleClick = (e) => {
      const spoiler = e.target.closest(".format-spoiler");
      if (spoiler) {
        spoiler.classList.toggle("revealed");
      }
    };

    ref.current.addEventListener("click", handleClick);
    return () => ref.current?.removeEventListener("click", handleClick);
  }, [text]);

  const html = useMemo(() => formatText(text), [text]);

  if (!text) return null;

  return (
    <div
      ref={ref}
      className={`formatted-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
