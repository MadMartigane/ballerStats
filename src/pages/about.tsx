import webDAV from '../libs/file-webdav'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@suid/material'
import { For } from 'solid-js'

function BasicTable(directoryContent: any) {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>File</TableCell>
            <TableCell align="right">Path</TableCell>
            <TableCell align="right">Update</TableCell>
            <TableCell align="right">Zise</TableCell>
            <TableCell align="right">Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <For each={directoryContent}>
            {row => (
              <TableRow
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.filename}
                </TableCell>
                <TableCell align="right">{row.basename}</TableCell>
                <TableCell align="right">{row.lastmod}</TableCell>
                <TableCell align="right">{row.zise}</TableCell>
                <TableCell align="right">{row.type}</TableCell>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function About() {
  const directoryContent = webDAV.getDirectoryContents()

  return (
    <section class="bg-pink-100 text-gray-700 p-8">
      <h1 class="text-2xl font-bold">About</h1>
      <p class="mt-4">A page all about this website.</p>
      BasicTable(directoryContent);
      <p>
        <span>We love Solid</span>
      </p>
    </section>
  )
}
