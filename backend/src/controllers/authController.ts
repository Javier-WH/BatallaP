import { Request, Response } from 'express';
import User from '@/models/User';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isValid = await user.validatePassword(password);

    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Save session
    (req.session as any).user = {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    res.json({ message: 'Login successful', user: (req.session as any).user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error check console' });
  }
};

export const logout = (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Default cookie name for express-session
    res.json({ message: 'Logout successful' });
  });
};

export const me = (req: Request, res: Response) => {
  const user = (req.session as any).user;
  if (user) {
    res.json({ authenticated: true, user });
  } else {
    res.status(401).json({ authenticated: false });
  }
};

// Temporary register for testing purposes
export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, firstName, lastName, role } = req.body;
    const user = await User.create({ username, password, firstName, lastName, role });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error });
  }
}
