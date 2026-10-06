import ViewInArIcon from '@mui/icons-material/ViewInArSharp';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MiradorMenuButton from '../../containers/MiradorMenuButton';
import { xrStore } from '../xrStore';

/**
 * Starts an immersive-vr session showing a window's current work. Renders
 * nothing without a window to show. enterVR() must run synchronously inside
 * the click for Safari's user-activation requirement.
 */
export function EnterXRButton({ className = undefined, enterXR, labelKey = 'enterXR', windowId = undefined }) {
  const { t } = useTranslation();

  if (!windowId) return null;

  /** */
  const handleClick = () => {
    enterXR(windowId);
    xrStore.enterVR().catch((error) => console.warn('[Mirador XR: could not start session]', error));
  };

  return (
    <MiradorMenuButton className={className} aria-label={t(labelKey)} onClick={handleClick}>
      <ViewInArIcon />
    </MiradorMenuButton>
  );
}

EnterXRButton.propTypes = {
  className: PropTypes.string,
  enterXR: PropTypes.func.isRequired,
  labelKey: PropTypes.string,
  windowId: PropTypes.string,
};
