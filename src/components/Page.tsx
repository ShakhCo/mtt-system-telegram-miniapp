import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { type PropsWithChildren, useEffect } from 'react';
import { usePageContext } from '@/contexts/PageContext';

export function Page({ children, back = true, title, onBack }: PropsWithChildren<{
  /**
   * True if it is allowed to go back from this page.
   */
  back?: boolean;
  /**
   * Page title to display in the NavBar
   */
  title?: string;
  /**
   * Custom back button handler
   */
  onBack?: () => void;
}>) {
  const navigate = useNavigate();
  const { setTitle } = usePageContext();

  useEffect(() => {
    if (back) {
      backButton.show();
      return backButton.onClick(() => {
        if (onBack) {
          onBack();
        } else {
          navigate(-1);
        }
      });
    }
    backButton.hide();
  }, [back, navigate, onBack]);

  useEffect(() => {
    if (title) {
      setTitle(title);
    }
  }, [title, setTitle]);

  return <main className=''>{children}</main>;
}