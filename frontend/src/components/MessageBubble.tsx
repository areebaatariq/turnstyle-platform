import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Message, Look, ClosetItem } from '@/types';
import { getLookById, getLookItemsByLookId } from '@/utils/lookStorage';
import { getClosetItems, getOrCreateCloset } from '@/utils/closetStorage';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { Sparkles, Shirt } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
  senderPhoto?: string;
  onSharedContentClick?: () => void;
}

const MessageBubble = ({ message, isOwn, senderName, senderPhoto, onSharedContentClick }: MessageBubbleProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderSharedContent = () => {
    if (!message.sharedContentType || !message.sharedContentId) return null;

    if (message.sharedContentType === 'look') {
      // For MVP: This is a synchronous render function
      // Look data should be loaded in parent component and passed as props
      // Keeping sync version for now to maintain MVP simplicity
      const look = getLookById(message.sharedContentId);
      if (!look) return null;

      const lookItems = getLookItemsByLookId(look.id);
      const closet = getOrCreateCloset(look.clientId);
      const closetItems = getClosetItems(closet.id);
      const items = lookItems
        .map(li => closetItems.find(ci => ci.id === li.itemId))
        .filter((item): item is ClosetItem => item !== undefined)
        .slice(0, 3);

      return (
        <Card 
          className="mt-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={onSharedContentClick}
        >
          <div className="flex items-start gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{look.name}</p>
              {look.occasion && (
                <p className="text-xs text-muted-foreground">{look.occasion}</p>
              )}
              <div className="flex gap-1 mt-2">
                {items.map(item => (
                  <img
                    key={item.id}
                    src={toFullSizeImageUrl(item.photoUrl)}
                    alt={item.name}
                    className="w-12 h-12 object-contain rounded bg-muted"
                  />
                ))}
                {lookItems.length > 3 && (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs font-medium text-gray-600">
                    +{lookItems.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (message.sharedContentType === 'item') {
      // This would load the closet item
      // For now, just show a placeholder
      return (
        <Card 
          className="mt-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={onSharedContentClick}
        >
          <div className="flex items-center gap-3">
            <div className="bg-pink-100 p-2 rounded-lg">
              <Shirt className="h-5 w-5 text-pink-600" />
            </div>
            <p className="font-medium text-sm">Shared a closet item</p>
          </div>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className={`flex gap-2 sm:gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} min-w-0`}>
      {!isOwn && (
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
          <AvatarImage src={senderPhoto} />
          <AvatarFallback className="text-[10px] sm:text-xs">
            {getInitials(senderName)}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%] min-w-0`}>
        <div
          className={`rounded-2xl px-3 py-2 sm:px-4 ${
            isOwn
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
        </div>
        
        {renderSharedContent()}
        
        <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 px-1 sm:px-2">
          {format(new Date(message.createdAt), 'p')}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;