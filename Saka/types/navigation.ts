import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  Signup: undefined;
};

export type StackNavigationProps<T extends keyof RootStackParamList> = StackNavigationProp<RootStackParamList, T>;
