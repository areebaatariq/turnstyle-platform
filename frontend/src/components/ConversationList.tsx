import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isToday, isYesterday } from 'date-fns';
import { Message } from '@/types';

interface Conversation {
  userId: string;
  userName: string;
  userPhoto?: string;
  lastMessage: Message;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedUserId?: string;
  onSelectConversation: (userId: string) => void;
}

const ConversationList = ({ conversations, selectedUserId, onSelectConversation }: ConversationListProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'p');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const truncateMessage = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (conversations.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start messaging your clients
          </p>
        </div>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {conversations.map((conversation) => {
          const isSelected = selectedUserId === conversation.userId;
          
          return (
            <Card
              key={conversation.userId}
              className={`p-4 cursor-pointer transition-colors ${
                isSelected ? 'bg-purple-50 border-purple-200' : 'hover:bg-gray-100'
              }`}
              onClick={() => onSelectConversation(conversation.userId)}
            >
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={conversation.userPhoto} />
                  <AvatarFallback>
                    {getInitials(conversation.userName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium truncate">{conversation.userName}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatMessageTime(new Date(conversation.lastMessage.createdAt))}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${
                      conversation.unreadCount > 0 ? 'font-medium text-gray-900' : 'text-muted-foreground'
                    }`}>
                      {truncateMessage(conversation.lastMessage.messageText)}
                    </p>
                    
                    {conversation.unreadCount > 0 && (
                      <Badge className="ml-2 flex-shrink-0 bg-purple-600">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default ConversationList;