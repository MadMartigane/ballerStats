import { Box } from '@suid/material'
import { For } from 'solid-js'

const lorem = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Quisque id diam vel quam. Pretium vulputate sapien nec sagittis aliquam malesuada bibendum arcu vitae. Neque egestas congue quisque egestas diam. Ullamcorper morbi tincidunt ornare massa. Velit dignissim sodales ut eu sem integer vitae justo. Gravida dictum fusce ut placerat orci nulla. Laoreet sit amet cursus sit amet dictum sit amet justo. Nibh nisl condimentum id venenatis. Iaculis eu non diam phasellus vestibulum lorem sed risus ultricies. Lectus mauris ultrices eros in. Amet purus gravida quis blandit turpis cursus. Posuere sollicitudin aliquam ultrices sagittis orci a scelerisque purus. Leo urna molestie at elementum. Venenatis tellus in metus vulputate eu. Viverra vitae congue eu consequat ac felis. Et netus et malesuada fames ac. Libero nunc consequat interdum varius sit. In nisl nisi scelerisque eu ultrices.\
\
Aliquam nulla facilisi cras fermentum. Sed felis eget velit aliquet sagittis id consectetur purus ut. Tellus orci ac auctor augue mauris. Vel fringilla est ullamcorper eget nulla facilisi etiam. Massa enim nec dui nunc mattis. Facilisi morbi tempus iaculis urna id volutpat lacus laoreet non. Eget egestas purus viverra accumsan in nisl nisi scelerisque. Commodo elit at imperdiet dui accumsan sit amet nulla facilisi. At varius vel pharetra vel turpis nunc eget. Libero nunc consequat interdum varius. Convallis convallis tellus id interdum velit. Aliquam id diam maecenas ultricies mi eget mauris pharetra et.\
\
Auctor eu augue ut lectus arcu bibendum. Quam vulputate dignissim suspendisse in. Felis eget nunc lobortis mattis. Quis imperdiet massa tincidunt nunc. Posuere sollicitudin aliquam ultrices sagittis. Nibh ipsum consequat nisl vel pretium lectus quam id leo. Blandit massa enim nec dui nunc. Nunc id cursus metus aliquam. Morbi tristique senectus et netus et malesuada. Arcu dui vivamus arcu felis bibendum ut tristique et egestas. Diam donec adipiscing tristique risus nec feugiat in fermentum posuere.\
\
Nunc consequat interdum varius sit amet mattis vulputate. Morbi leo urna molestie at elementum eu facilisis sed odio. Vulputate ut pharetra sit amet aliquam id. Amet massa vitae tortor condimentum lacinia quis. Dolor sed viverra ipsum nunc aliquet bibendum enim facilisis gravida. Quam viverra orci sagittis eu volutpat odio facilisis. Odio tempor orci dapibus ultrices in iaculis nunc. Sit amet nisl suscipit adipiscing. Morbi non arcu risus quis varius quam quisque. Tellus at urna condimentum mattis. Fermentum posuere urna nec tincidunt praesent. Urna id volutpat lacus laoreet non curabitur gravida arcu. Amet nisl suscipit adipiscing bibendum est ultricies integer. Mauris cursus mattis molestie a. Eleifend mi in nulla posuere sollicitudin aliquam ultrices. Platea dictumst vestibulum rhoncus est pellentesque elit.\
\
Commodo quis imperdiet massa tincidunt nunc pulvinar sapien et ligula. Mi sit amet mauris commodo quis imperdiet. Vitae aliquet nec ullamcorper sit. Diam maecenas sed enim ut sem viverra aliquet. Faucibus a pellentesque sit amet porttitor eget. Massa vitae tortor condimentum lacinia quis vel eros donec ac. Faucibus scelerisque eleifend donec pretium vulputate sapien nec sagittis. Pellentesque diam volutpat commodo sed egestas egestas. Placerat vestibulum lectus mauris ultrices eros in cursus turpis massa. Sit amet risus nullam eget. Faucibus turpis in eu mi bibendum neque egestas congue. Arcu felis bibendum ut tristique et egestas quis.',
]

export default function Matchs() {
  return (
    <Box>
      <h1 class="text-2xl font-bold">Matchs</h1>

      <p class="mt-4">TODO: List your matchs here !</p>

      <For each={lorem} fallback={<div>Loading...</div>}>
        {item => <p>{item}</p>}
      </For>
    </Box>
  )
}
