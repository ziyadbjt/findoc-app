export default function BrandLogo({ surface = "app", theme = "dark", className = "", alt = "FinDoc" }) {
  let src = "/logo-findoc-day-v2-transparent.png";

  if (surface === "marketing") {
    src = "/logo-findoc-day-v2-transparent.png";
  } else if (surface === "auth") {
    src = theme === "light" ? "/logo-findoc-day-v2-transparent.png" : "/logo-findoc-night-transparent.png";
  } else if (surface === "app") {
    src = theme === "light" ? "/logo-findoc-day-v2-transparent.png" : "/logo-findoc-night-transparent.png";
  }

  return <img className={className} src={src} alt={alt} />;
}
