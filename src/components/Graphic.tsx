export function Graphic({
  className,
  image,
  name,
}: {
  className: string;
  image?: string;
  name: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span aria-hidden="true" className={`game-graphic ${className}`}>
      {image && (
        <img
          alt=""
          key={image}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={image}
        />
      )}
      <span>{initials}</span>
    </span>
  );
}
