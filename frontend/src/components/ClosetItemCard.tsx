import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, Archive } from 'lucide-react';
import { ClosetItem } from '@/types';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';

interface ClosetItemCardProps {
  item: ClosetItem;
  onEdit: (item: ClosetItem) => void;
  onDelete: (item: ClosetItem) => void;
  onArchive: (item: ClosetItem) => void;
  onClick: (item: ClosetItem) => void;
}

const ClosetItemCard = ({ item, onEdit, onDelete, onArchive, onClick }: ClosetItemCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
      <CardContent className="p-0">
        <div className="relative" onClick={() => onClick(item)}>
          <ItemImageWithPreview
            photoUrl={item.photoUrl}
            alt={item.name}
            caption={item.name}
            className="w-full h-56 sm:h-48 object-contain bg-muted rounded-t-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Crect fill="%23ddd" width="56" height="56"/%3E%3C/svg%3E';
            }}
          />
          {item.archived && (
            <Badge className="absolute top-2 left-2 bg-gray-500">Archived</Badge>
          )}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(item); }}>
                  <Archive className="mr-2 h-4 w-4" />
                  {item.archived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <h3 className="font-semibold truncate">{item.name}</h3>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{item.category}</Badge>
            {item.subcategory && (
              <Badge variant="outline" className="text-xs">{item.subcategory}</Badge>
            )}
            {item.brand && (
              <Badge variant="secondary" className="text-xs">{item.brand}</Badge>
            )}
            {item.size && (
              <Badge variant="secondary" className="text-xs">Size: {item.size}</Badge>
            )}
          </div>

          {item.colorTags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.colorTags.map((color, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-gray-100 rounded-full"
                >
                  {color}
                </span>
              ))}
            </div>
          )}

          {item.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ClosetItemCard;