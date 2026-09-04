import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import { User, Person, Role, PersonRole, Contact } from '@/models/index'; // Import from index to ensure associations

export const login = async (req: Request, res: Response): Promise<void> => {
  // Prevent browser from caching the login response (Opera/Chrome cache POST 401s)
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    const { username, password } = req.body;

    // Fetch user with associated Person and Roles
    // Use case-insensitive username match so "javier" matches "Javier".
    // SQLite uses LIKE (case-insensitive for ASCII by default), MySQL uses LOWER() for
    // case-insensitive comparison.
    const isSqlite = sequelize.getDialect() === 'sqlite';
    const user = await User.findOne({
      where: isSqlite
        ? { username: { [Op.like]: username } }
        : sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), username.toLowerCase()),
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
      roleName,
      roles,
      // Contact Info
      phone1,
      phone2,
      email,
      address,
      whatsapp
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

    // 3. Create Contact linked to Person
    await Contact.create({
      phone1,
      phone2,
      email,
      address,
      whatsapp,
      personId: person.id
    });

    // 4. Assign Roles
    const rolesToAssign = roles || (roleName ? [roleName] : []);

    for (const name of rolesToAssign) {
      let role = await Role.findOne({ where: { name } });
      if (!role) {
        // Create if not exists (optional, or throw error)
        role = await Role.create({ name });
      }

      if (role) {
        await PersonRole.create({
          personId: person.id,
          roleId: role.id
        });
      }
    }

    res.status(201).json({ message: 'User registered successfully', user, person });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error });
  }
}
