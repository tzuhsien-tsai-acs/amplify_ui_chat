import React from 'react';
import { Card, Heading, Collection } from '@aws-amplify/ui-react';

interface UserListProps {
  users: User[];
}

const UserList: React.FC<UserListProps> = ({ users }) => {
  return (
    <Card className="user-list-container">
      <Heading level={5}>Online Users ({users.filter(user => user.isOnline).length})</Heading>
      
      <Collection
        items={users}
        type="list"
        direction="column"
        gap="0.5rem"
      >
        {(user) => (
          <div key={user.id} className="user-item">
            <span 
              className={`online-indicator ${user.isOnline ? 'online' : 'offline'}`}
              title={user.isOnline ? 'Online' : 'Offline'}
            ></span>
            <span className="username">{user.username}</span>
          </div>
        )}
      </Collection>
      
      <style jsx>{`
        .user-list-container {
          margin-top: 1rem;
          padding: 0.5rem;
        }
        
        .user-item {
          display: flex;
          align-items: center;
          padding: 0.25rem 0;
        }
        
        .online-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }
        
        .online {
          background-color: #4caf50;
        }
        
        .offline {
          background-color: #9e9e9e;
        }
        
        .username {
          font-size: 0.9rem;
        }
      `}</style>
    </Card>
  );
};

export default UserList;