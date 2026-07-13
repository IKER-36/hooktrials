import { Link } from 'react-router-dom';

export function BrandMark() {
  return <img src="/brand/hooklogo-transparent.png" alt="" aria-hidden="true" />;
}

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="HookTrials home">
      <span className="brand-mark">
        <BrandMark />
      </span>
      <span>HookTrials</span>
    </Link>
  );
}
