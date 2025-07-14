import React, { useEffect, useState } from 'react';
import { 
  Authenticator, 
  Button, 
  Heading, 
  View, 
  Text,
  useTheme,
  useAuthenticator
} from '@aws-amplify/ui-react';
import { Auth } from 'aws-amplify';

interface AmplifyAuthProps {
  onSignIn: (user: any) => void;
}

const AmplifyAuth: React.FC<AmplifyAuthProps> = ({ onSignIn }) => {
  const [authState, setAuthState] = useState<'signIn' | 'signedIn' | 'signUp' | 'loading'>('loading');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);
      setAuthState('signedIn');
      onSignIn(currentUser);
    } catch (err) {
      setUser(null);
      setAuthState('signIn');
    }
  }

  async function handleSignOut() {
    try {
      await Auth.signOut();
      setUser(null);
      setAuthState('signIn');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  }

  const components = {
    Header() {
      const { tokens } = useTheme();
      
      return (
        <View textAlign="center" padding={tokens.space.large}>
          <Heading level={3}>AWS Amplify Chat App</Heading>
        </View>
      );
    },
    Footer() {
      const { tokens } = useTheme();
      
      return (
        <View textAlign="center" padding={tokens.space.medium}>
          <Text color={tokens.colors.neutral[80]}>
            &copy; {new Date().getFullYear()} AWS Amplify Chat App. All Rights Reserved.
          </Text>
        </View>
      );
    },
    SignIn: {
      Header() {
        const { tokens } = useTheme();
        
        return (
          <Heading
            padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
            level={3}
          >
            Sign in to your account
          </Heading>
        );
      },
      Footer() {
        const { toSignUp } = useAuthenticator();
        
        return (
          <View textAlign="center">
            <Button
              fontWeight="normal"
              onClick={toSignUp}
              size="small"
              variation="link"
            >
              Don't have an account? Sign up
            </Button>
          </View>
        );
      },
    },
    SignUp: {
      Header() {
        const { tokens } = useTheme();
        
        return (
          <Heading
            padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
            level={3}
          >
            Create a new account
          </Heading>
        );
      },
      Footer() {
        const { toSignIn } = useAuthenticator();
        
        return (
          <View textAlign="center">
            <Button
              fontWeight="normal"
              onClick={toSignIn}
              size="small"
              variation="link"
            >
              Already have an account? Sign in
            </Button>
          </View>
        );
      },
    },
  };

  if (authState === 'loading') {
    return <div>Loading...</div>;
  }

  if (authState === 'signedIn' && user) {
    return (
      <div className="auth-signed-in">
        <div className="auth-user-info">
          <h3>Welcome, {user.username || user.attributes?.email}</h3>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <Authenticator components={components}>
        {({ signOut, user }) => {
          setUser(user);
          setAuthState('signedIn');
          onSignIn(user);
          return (
            <div className="auth-signed-in">
              <div className="auth-user-info">
                <h3>Welcome, {user.username || user.attributes?.email}</h3>
                <Button onClick={signOut}>Sign Out</Button>
              </div>
            </div>
          );
        }}
      </Authenticator>
    </div>
  );
};

export default AmplifyAuth;