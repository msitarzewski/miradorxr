import ViewInArIcon from '@mui/icons-material/ViewInArSharp';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MiradorMenuButton from '../../containers/MiradorMenuButton';
import { xrStore } from '../xrStore';

/**
 * Workspace control panel button that starts an immersive-vr session.
 * enterVR() must run synchronously inside the click for Safari's
 * user-activation requirement.
 */
export function EnterXRButton({ className = undefined }) {
  const { t } = useTranslation();

  /** */
  const handleClick = () => {
    xrStore.enterVR().catch((error) => console.warn('[Mirador XR: could not start session]', error));
  };

  return (
    <MiradorMenuButton className={className} aria-label={t('enterXR')} onClick={handleClick}>
      <ViewInArIcon />
    </MiradorMenuButton>
  );
}

EnterXRButton.propTypes = {
  className: PropTypes.string,
};
