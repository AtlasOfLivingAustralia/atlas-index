import { Switch, useMantineTheme, rem, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoonStars } from '@tabler/icons-react';

function ColorSchemeToggle() {
  const theme = useMantineTheme();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme({
    keepTransitions: true,
  });

  const sunIcon = (
    <IconSun
      style={{ width: rem(16), height: rem(16) }}
      stroke={2.5}
      color={theme.colors.flamingo[3]}
    />
  );

  const moonIcon = (
    <IconMoonStars
      style={{ width: rem(16), height: rem(16) }}
      stroke={2.5}
      color={theme.colors.glacial[3]}
    />
  );

  return (
    <Switch
      checked={colorScheme === 'light'}
      onChange={toggleColorScheme}
      size="md"
      color="dark.4"
      onLabel={sunIcon}
      offLabel={moonIcon}
    />
  );
}

export default ColorSchemeToggle;
