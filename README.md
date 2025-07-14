# AWS Amplify Chat Application

This repository contains a real-time chat application built with React and AWS Amplify. It provides features like user authentication, real-time messaging, and chat room management.

## Project Structure

The project is organized as follows:

```
chat-app-root/
└── chat-app-frontend/                # Frontend React project
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── ChatMessage.tsx       # Single chat message component
    │   │   ├── MessageInput.tsx      # Message input component
    │   │   └── UserList.tsx          # Online users list component
    │   ├── auth/
    │   │   └── AmplifyAuth.tsx       # Authentication UI and logic
    │   ├── hooks/
    │   │   └── useChatRoom.ts        # Custom hook for chat room logic
    │   ├── App.tsx                   # Main application component
    │   ├── index.tsx                 # Application entry point
    │   ├── aws-exports.js            # AWS Amplify auto-generated config
    │   └── react-app-env.d.ts        # TypeScript definitions
    └── package.json                  # Frontend project dependencies
```

## Quick Start Guide

Please refer to the README.md file in the chat-app-root directory for detailed setup instructions.
