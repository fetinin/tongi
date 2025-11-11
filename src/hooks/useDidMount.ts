import { useEffect, useState } from 'react';

/**
 * @return True, if component was mounted.
 */
export function useDidMount(): boolean {
  const [didMount, setDidMount] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDidMount(true);
  }, []);

  return didMount;
}
