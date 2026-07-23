import { useData } from '@/features/data/context/useData';
import ChatInterface from '@/features/chat/components/ChatInterface';
import StatusPanel from '@/shared/layout/StatusPanel';

const ChatPage = () => {
  const { isHydrating, apiError, retryHydrate } = useData();

  if (isHydrating) {
    return (
      <StatusPanel
        title="Loading chat"
        message="Preparing the local analytics service before opening the chat interface."
      />
    );
  }

  if (apiError) {
    return (
      <StatusPanel
        title="Chat unavailable"
        message={apiError}
        actionLabel="Retry"
        onAction={() => {
          void retryHydrate();
        }}
      />
    );
  }

  return <ChatInterface />;
};

export default ChatPage;
