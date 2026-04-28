export default function BrandLogo({ surface = "app", theme = "dark", className = "", alt = "FinDoc" }) {
  let src = "/logo-findoc-mono.png";

  if (surface === "marketing") {
    src = "/logo-findoc-day.png";
  } else if (surface === "auth") {
    src = theme === "light" ? "/logo-findoc-day.png" : "/logo-findoc-night.png";
  } else if (surface === "app") {
    src = theme === "light" ? "/logo-findoc-mono.png" : "/logo-findoc-night.png";
  }

  return <img className={className} src={src} alt={alt} />;
}
