import { Link } from 'react-router-dom';
import { Placeholder } from '@collector/ui-shared';

export function HomeScreen(): JSX.Element {
  return (
    <div>
      <Placeholder label="The Collector" />
      <nav>
        <Link to="/run-start">Iniciar run</Link>
      </nav>
    </div>
  );
}
