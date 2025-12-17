import { Request, Response } from 'express';
import { User, Person, Role, PersonRole } from '@/models/index'; // Import from index to ensure associations

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Fetch user with associated Person and Roles
    // Note: We need to ensure associations are loaded.
    const user = await User.findOne({
      where: { username },
      include: [
        {
          model: Person,
          as: 'person',
          include: [
            {
              model: Role,
              as: 'roles',
              through: {
                attributes: [] // Don't include the junction table attributes in the result
              }
            }
          ]
        }
      ]
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isValid = await user.validatePassword(password);

    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }


    const person = (user as any).person; // Type casting might be needed until types are fully generated/inferred
    const roles = person ? person.roles : [];

    // Save session (adapt to new structure)
    (req.session as any).user = {
      id: user.id,
      username: user.username,
      personId: person?.id,
      roles: roles.map((r: any) => r.name), // Accessing role name
      firstName: person?.firstName,
      lastName: person?.lastName
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
    res.clearCookie('connect.sid');
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

// Updated register to handle new structure
export const register = async (req: Request, res: Response) => {
  try {
    const {
      username,
      password,
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      roleName
    } = req.body;

    // 1. Create User
    const user = await User.create({ username, password });

    // 2. Create Person linked to User
    const person = await Person.create({
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      userId: user.id
    });

    // 3. Assign Role (assuming role exists, or find/create it)
    if (roleName) {
      // Find role by name
      let role = await Role.findOne({ where: { name: roleName } });
      if (!role) {
        // Create if not exists (optional, or throw error)
        // For now, let's assume we create it if it's a valid enum value
        role = await Role.create({ name: roleName });
      }

      if (role) {
        // Manually or via helper
        // Since we are not using the 'addRole' mixin yet (TypeScript types needs setup), we use PersonRole or standard methods if available.
        // Getting the association method might require type assertions. 
        // Let's use the explicit model approach for safety if methods aren't typed.
        await PersonRole.create({
          personId: person.id,
          roleId: role.id
        });
      }
    }

    res.status(201).json({ message: 'User registered', user, person });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error });
  }
}
